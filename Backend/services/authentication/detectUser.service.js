import { supabase } from "../../config/supabase.js";

const normalizeIdentifier = (value) => String(value ?? "").trim();

const isMissingColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("column") && message.includes("does not exist");
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

    if (error) throw error;
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
    if (error && !isMissingColumnError(error)) throw error;
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

    if (error) throw error;
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

  if (error) throw error;
  return data || null;
};

export const detectUserService = async (identifier) => {
  const rawId = normalizeIdentifier(identifier);

  const admin = await findAdminByIdentifier(rawId);
  if (admin) {
    return {
      exists: true,
      userType: "ADMIN",
      nextStep: "PASSWORD",
      name: admin.name || "Admin",
    };
  }

  if (rawId.toUpperCase().startsWith("STF")) {
    const { data: agent, error } = await supabase
      .from("agents")
      .select("agent_id, agent_name")
      .ilike("agent_id", rawId.toUpperCase())
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (agent) {
      return {
        exists: true,
        userType: "AGENT",
        nextStep: "PASSWORD",
        name: agent.agent_name || "Agent",
      };
    }
  }

  const customer = await findCustomerByIdentifier(rawId);
  if (customer) {
    const hasOtpDelivery = Boolean(String(customer.email || "").trim());
    return {
      exists: true,
      userType: "CUSTOMER",
      nextStep: "OTP",
      name: customer.customer_name || "Customer",
      hasOtpDelivery,
      emailMasked: hasOtpDelivery
        ? customer.email.replace(/(^.).*(@.*$)/, "$1***$2")
        : null,
    };
  }

  const mobile = rawId.replace(/\D/g, "");
  if (mobile.length >= 10) {
    return { exists: false, userType: "NEW_USER", nextStep: "REGISTER" };
  }

  return { exists: false, error: "User not found", nextStep: "IDENTIFIER" };
};

