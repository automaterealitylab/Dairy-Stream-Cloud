import { supabase } from "../../config/supabase.js";
import { generateCustomerOtp } from "./customerAuth.service.js";

const normalizeIdentifier = (value) => String(value ?? "").trim();
const normalizeCustomerLoginIdentifier = (value) => {
  const normalized = normalizeIdentifier(value);
  return normalized.includes("@")
    ? normalized.toLowerCase()
    : normalized.replace(/\D/g, "");
};

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
};

const logLookupError = (lookup, error, meta = {}) => {
  console.error("[AUTH DETECT] database lookup error:", {
    lookup,
    ...meta,
    message: error?.message || String(error),
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  });
};

const findAdminByIdentifier = async (rawIdentifier) => {
  const identifier = normalizeIdentifier(rawIdentifier);
  const isEmail = identifier.includes("@");

  if (isEmail) {
    const { data, error } = await supabase
      .from("admins")
      .select("id, email, name")
      .ilike("email", identifier)
      .limit(1)
      .maybeSingle();

    if (error) {
      logLookupError("admins.email", error, { identifierType: "email" });
      throw error;
    }
    return data || null;
  }

  const mobile = identifier.replace(/\D/g, "");
  if (mobile.length < 10) return null;

  for (const column of ["phone", "phone_number"]) {
    const { data, error } = await supabase
      .from("admins")
      .select(`id, email, name, ${column}`)
      .eq(column, mobile)
      .limit(1)
      .maybeSingle();

    if (!error && data) return data;
    if (error && !isMissingColumnError(error)) {
      logLookupError("admins.mobile", error, { column });
      throw error;
    }
  }

  return null;
};

const findCustomerByIdentifier = async (rawIdentifier) => {
  const identifier = normalizeIdentifier(rawIdentifier);
  const isEmail = identifier.includes("@");

  if (isEmail) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, customer_name, email")
      .ilike("email", identifier)
      .limit(1)
      .maybeSingle();

    if (error) {
      logLookupError("customers.email", error, { identifierType: "email" });
      throw error;
    }
    return data || null;
  }

  const mobile = identifier.replace(/\D/g, "");
  if (mobile.length < 10) return null;

  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_name, email")
    .eq("phone_number", mobile)
    .limit(1)
    .maybeSingle();

  if (error) {
    logLookupError("customers.phone_number", error);
    throw error;
  }
  return data || null;
};

const findAgentByStaffId = async (rawIdentifier) => {
  const normalizedAgentId = normalizeIdentifier(rawIdentifier).toUpperCase();
  if (!normalizedAgentId.startsWith("STF")) return null;

  const { data, error } = await supabase
    .from("agents")
    .select("agent_id, agent_name")
    .ilike("agent_id", normalizedAgentId)
    .limit(1)
    .maybeSingle();

  if (error) {
    logLookupError("agents.agent_id", error);
    throw error;
  }
  return data || null;
};

export const detectUserService = async (identifier, options = {}) => {
  const rawId = normalizeIdentifier(identifier);
  const { requestCustomerOtp = false, dairyId = null } = options;
  const mobile = rawId.replace(/\D/g, "");
  const isStaffId = rawId.toUpperCase().startsWith("STF");

  if (isStaffId) {
    const agent = await findAgentByStaffId(rawId);
    if (agent) {
      return {
        exists: true,
        userType: "AGENT",
        nextStep: "PASSWORD",
        name: agent.agent_name || "Agent",
      };
    }

    return { exists: false, error: "User not found", nextStep: "IDENTIFIER" };
  }

  const [admin, customer] = await Promise.all([
    findAdminByIdentifier(rawId),
    findCustomerByIdentifier(rawId),
  ]);

  if (admin) {
    return {
      exists: true,
      userType: "ADMIN",
      nextStep: "PASSWORD",
      name: admin.name || "Admin",
    };
  }

  if (customer) {
    const hasOtpDelivery = Boolean(String(customer.email || "").trim());

    if (requestCustomerOtp && hasOtpDelivery) {
      await generateCustomerOtp({
        identifier: normalizeCustomerLoginIdentifier(rawId),
        dairyId,
        customer,
      });
    }

    return {
      exists: true,
      userType: "CUSTOMER",
      nextStep: "OTP",
      name: customer.customer_name || "Customer",
      hasOtpDelivery,
      otpRequested: Boolean(requestCustomerOtp && hasOtpDelivery),
      emailMasked: hasOtpDelivery
        ? customer.email.replace(/(^.).*(@.*$)/, "$1***$2")
        : null,
    };
  }

  if (mobile.length >= 10) {
    return { exists: false, userType: "NEW_USER", nextStep: "REGISTER" };
  }

  return { exists: false, error: "User not found", nextStep: "IDENTIFIER" };
};

