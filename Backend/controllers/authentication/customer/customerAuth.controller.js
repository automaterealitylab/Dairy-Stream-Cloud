import bcrypt from "bcryptjs";
import {
  generateCustomerOtp,
  verifyCustomerOtp,
  customerOtpLoginService
} from "../../../services/authentication/customer.auth.service.js";
import { generateToken } from "../../../utils/jwt.js";

import { supabase } from "../../../config/supabase.js";

const normalizeIdentifier = (value) => String(value ?? "").trim();
const normalizeDigits = (value) => String(value ?? "").replace(/\D/g, "");
let membershipLinkColumnPromise;

const buildPhoneVariants = (identifier) => {
  const raw = normalizeIdentifier(identifier);
  const digitsOnly = raw.replace(/\D/g, "");
  const variants = new Set([raw]);

  if (digitsOnly) {
    variants.add(digitsOnly);
    if (digitsOnly.length > 10) variants.add(digitsOnly.slice(-10));
  }

  return [...variants].filter(Boolean);
};

const buildLoosePhonePattern = (identifier) => {
  const digitsOnly = normalizeIdentifier(identifier).replace(/\D/g, "");
  const last10 = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
  if (last10.length < 10) return null;
  return `%${last10.slice(0, 5)}%${last10.slice(5)}%`;
};

const resolveMembershipLinkColumn = async () => {
  if (!membershipLinkColumnPromise) {
    membershipLinkColumnPromise = (async () => {
      const compatibleColumns = ["customer_id", "customerid", "customerId", "user_id"];

      for (const column of compatibleColumns) {
        const { error } = await supabase
          .from("memberships")
          .select(column)
          .limit(1);

        if (!error) return column;

        const message = String(error.message || "").toLowerCase();
        const isMissingColumn = message.includes("column") && message.includes("does not exist");
        if (!isMissingColumn) throw new Error(error.message);
      }

      return null;
    })();
  }

  return membershipLinkColumnPromise;
};

const getCustomerMembership = async (customerId) => {
  if (!customerId) return null;
  const linkColumn = await resolveMembershipLinkColumn();
  if (!linkColumn) return null;

  const { data, error } = await supabase
    .from("memberships")
    .select("id, dairy_id")
    .eq(linkColumn, customerId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
};

const getCustomerMembershipForDairy = async (customerId, dairyId) => {
  if (!customerId || !dairyId) return null;
  const linkColumn = await resolveMembershipLinkColumn();
  if (!linkColumn) return null;

  const { data, error } = await supabase
    .from("memberships")
    .select("id, dairy_id")
    .eq(linkColumn, customerId)
    .eq("dairy_id", dairyId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
};

const getCustomerSubscriptions = async (customerId) => {
  if (!customerId) return [];

  const { data, error } = await supabase
    .from("subscriptions")
    .select("id, dairy_id, status")
    .eq("customer_id", customerId)
    .limit(50);

  if (error) {
    const message = String(error.message || "").toLowerCase();
    const missingTable = message.includes("relation") && message.includes("does not exist");
    if (missingTable) return [];
    throw new Error(error.message);
  }

  return data || [];
};

const findCustomerByIdentifier = async (identifier) => {
  if (identifier.includes("@")) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .ilike("email", identifier)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  const phoneVariants = buildPhoneVariants(identifier);
  const { data: exactData, error: exactError } = await supabase
    .from("customers")
    .select("*")
    .in("phone_number", phoneVariants)
    .limit(1)
    .maybeSingle();
  if (exactError) throw new Error(exactError.message);

  if (exactData) return exactData;

  const loosePattern = buildLoosePhonePattern(identifier);
  const targetDigits = normalizeDigits(identifier);
  const targetLast10 = targetDigits.length > 10 ? targetDigits.slice(-10) : targetDigits;
  if (!loosePattern && targetLast10.length !== 10) return null;

  if (loosePattern) {
    const { data: looseData, error: looseError } = await supabase
      .from("customers")
      .select("*")
      .ilike("phone_number", loosePattern)
      .limit(1)
      .maybeSingle();
    if (looseError) throw new Error(looseError.message);
    if (looseData) return looseData;
  }

  // Final fallback: normalize and compare last 10 digits in app code.
  // This avoids false misses when DB stores phone with prefixes/spaces/symbols.
  const { data: allCustomers, error: allCustomersError } = await supabase
    .from("customers")
    .select("*")
    .not("phone_number", "is", null)
    .limit(5000);

  if (allCustomersError) throw new Error(allCustomersError.message);

  const matched = (allCustomers || []).find((customer) => {
    const candidateDigits = normalizeDigits(customer.phone_number);
    const candidateLast10 =
      candidateDigits.length > 10 ? candidateDigits.slice(-10) : candidateDigits;
    return candidateLast10.length === 10 && candidateLast10 === targetLast10;
  });

  return matched || null;
};

// ===============================
// REQUEST OTP
// ===============================
export const requestOtp = async (req, res) => {
  try {
    let { dairyId } = req.body;
    const identifier = normalizeIdentifier(req.body.identifier);

    if (!dairyId) {
      const customer = await findCustomerByIdentifier(identifier);
      const membership = customer ? await getCustomerMembership(customer.id) : null;
      dairyId = membership?.dairy_id ?? null;
    }

    await generateCustomerOtp({ identifier, dairyId });

    res.json({
      success: true,
      message: "OTP sent successfully"
    });
  } catch (err) {
    const message = err?.message || "Failed to send OTP";
    res.status(400).json({
      success: false,
      error: message,
      message,
    });
  }
};

// ===============================
// VERIFY OTP + LOGIN
// ===============================
export const verifyOtpLogin = async (req, res) => {
  try {
    const { otp } = req.body;
    const { dairyId } = req.body;
    const identifier = normalizeIdentifier(req.body.identifier);
    const hasDairyId = Object.prototype.hasOwnProperty.call(req.body, "dairyId");

    let verifiedOtp;
    try {
      verifiedOtp = await verifyCustomerOtp({
        identifier,
        otp,
        dairyId: hasDairyId ? dairyId : undefined,
      });
    } catch (err) {
      if (!hasDairyId) throw err;
      verifiedOtp = await verifyCustomerOtp({
        identifier,
        otp,
        dairyId: undefined,
      });
    }

    const loginDairyId = verifiedOtp?.dairy_id ?? null;
    const result = await customerOtpLoginService({ identifier, dairyId: loginDairyId });

    // If dairyId is provided, verify membership for that specific dairy.
    // Otherwise, fallback to checking whether customer has any dairy membership.
    const requestedDairyId = hasDairyId ? dairyId : null;
    const specificMembership = requestedDairyId
      ? await getCustomerMembershipForDairy(result?.user?.id, requestedDairyId)
      : null;
    const anyMembership = requestedDairyId
      ? specificMembership
      : await getCustomerMembership(result?.user?.id);
    const subscriptions = await getCustomerSubscriptions(result?.user?.id);
    const specificSubscription = requestedDairyId
      ? subscriptions.find(
          (row) =>
            String(row?.dairy_id ?? "") === String(requestedDairyId) &&
            String(row?.status ?? "ACTIVE").toUpperCase() !== "CLOSED"
        ) ?? null
      : null;
    const anyActiveSubscription = subscriptions.find(
      (row) => String(row?.status ?? "ACTIVE").toUpperCase() !== "CLOSED"
    );

    const hasRegistration = requestedDairyId
      ? Boolean(specificMembership || specificSubscription)
      : Boolean(anyMembership?.dairy_id || anyActiveSubscription);

    const isRegisteredToRequestedDairy = requestedDairyId
      ? Boolean(specificMembership || specificSubscription)
      : hasRegistration;
    const redirect = hasRegistration ? "/customer/dashboard" : "/explore";

    res.json({
      success: true,
      token: result.token,
      user: result.user,
      isRegisteredToRequestedDairy,
      redirect,
    });
  } catch (err) {
    console.error("verifyOtpLogin error:", err.message);
    res.status(401).json({
      success: false,
      error: err.message,
    });
  }
};

export const detectUser = async (req, res) => {
  try {
    const identifier = normalizeIdentifier(req.body.identifier);

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: "Identifier is required",
      });
    }

    // Check if identifier is an email (potential admin)
    const isEmail = identifier.includes("@");
    
    if (isEmail) {
      // First check if this email is an admin
      const { data: adminData } = await supabase
        .from("admins")
        .select("id, email, name, dairy_id")
        .eq("email", identifier)
        .single();

      if (adminData) {
        console.log(`✅ Admin detected: ${identifier}`);
        return res.json({
          exists: true,
          userType: "ADMIN",
          nextStep: "PASSWORD",
          adminId: adminData.id,
          email: adminData.email,
        });
      }
    }

    // Check if it's a customer
    const customer = await findCustomerByIdentifier(identifier);

    if (!customer) {
      return res.json({
        exists: false,
        nextStep: "REGISTER",
      });
    }

    return res.json({
      exists: true,
      userType: "CUSTOMER",
      nextStep: "OTP",
      customerId: customer.id,
      dairy: null,
    });
  } catch (err) {
    console.error("detectUser error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to detect user",
    });
  }
};

export const passwordLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Check if it's an admin login
    const { data: adminData, error: adminError } = await supabase
      .from("admins")
      .select("*")
      .eq("email", email)
      .single();

    if (!adminError && adminData) {
      // Admin found - verify password
      const isValidPassword = await bcrypt.compare(password, adminData.password);

      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: "Invalid password",
        });
      }

      // Generate token for admin
      const token = generateToken({
        id: adminData.id,
        email: adminData.email,
        role: "ADMIN",
        dairyId: adminData.dairy_id,
      });

      return res.json({
        success: true,
        token,
        user: {
          id: adminData.id,
          name: adminData.name,
          email: adminData.email,
          role: "ADMIN",
        },
        redirect: "/admin/AdminDashboard",
      });
    }

    // If not admin, return error
    return res.status(401).json({
      success: false,
      error: "Invalid email or password",
    });
  } catch (err) {
    console.error("❌ Password login error:", err.message);
    res.status(500).json({
      success: false,
      error: "Login failed",
    });
  }
};
