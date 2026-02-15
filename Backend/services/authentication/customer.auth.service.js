import { supabase } from "../../config/supabase.js";
import { generateToken } from "../../utils/jwt.js";

const normalizeIdentifier = (value) => String(value ?? "").trim();
const otpStore = new Map();

const buildOtpKey = (identifier, dairyId) =>
  `${normalizeIdentifier(identifier)}::${dairyId == null ? "null" : String(dairyId)}`;

const purgeExpiredOtps = () => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (!value?.expiresAt || value.expiresAt <= now) {
      otpStore.delete(key);
    }
  }
};

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

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sendOtp = async ({ identifier, otp }) => {
  console.log(`[OTP] Identifier: ${identifier}, OTP: ${otp}`);
  
  // Log to file for easy access
  try {
    const logPath = path.join(__dirname, "../../otp.log");
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Identifier: ${identifier}, OTP: ${otp}\n`);
  } catch (err) {
    console.error("Failed to write to OTP log file:", err);
  }
};

// ===============================
// DETECT USER
// ===============================
export const detectUserService = async (identifier) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);

  if (normalizedIdentifier.includes("@")) {
    return { userType: "ADMIN", nextStep: "PASSWORD" };
  }

  if (normalizedIdentifier.toUpperCase().startsWith("STF")) {
    return { userType: "STAFF", nextStep: "PASSWORD" };
  }

  const phoneVariants = buildPhoneVariants(normalizedIdentifier);

  const { data } = await supabase
    .from("customers")
    .select("id")
    .in("phone_number", phoneVariants);

  if (!data || data.length === 0) {
    return { userType: "CUSTOMER", nextStep: "EXPLORE" };
  }

  if (data.length === 1) {
    return {
      userType: "CUSTOMER",
      nextStep: "OTP",
    };
  }

  return {
    userType: "CUSTOMER",
    dairies: data.map((c) => ({ id: c.id })),
    nextStep: "SELECT_DAIRY",
  };
};

// ===============================
// OTP
// ===============================
export const generateCustomerOtp = async ({ identifier, dairyId }) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  purgeExpiredOtps();
  const key = buildOtpKey(normalizedIdentifier, dairyId);
  otpStore.set(key, {
    identifier: normalizedIdentifier,
    dairy_id: dairyId ?? null,
    otp,
    expiresAt,
  });

  await sendOtp({ identifier: normalizedIdentifier, otp });
};

export const verifyCustomerOtp = async ({ identifier, otp, dairyId }) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const normalizedOtp = String(otp ?? "").trim();

  if (!normalizedOtp) {
    throw new Error("OTP is required");
  }

  purgeExpiredOtps();

  const candidates = [];
  for (const [key, value] of otpStore.entries()) {
    if (value.identifier !== normalizedIdentifier) continue;
    if (dairyId !== undefined) {
      const expectedDairy = dairyId ?? null;
      if (value.dairy_id !== expectedDairy) continue;
    }
    candidates.push({ key, ...value });
  }

  candidates.sort((a, b) => b.expiresAt - a.expiresAt);
  const latestOtp = candidates[0];

  if (!latestOtp) throw new Error("Invalid or expired OTP");
  if (latestOtp.otp !== normalizedOtp) throw new Error("Invalid OTP");

  otpStore.delete(latestOtp.key);

  return latestOtp;
};

// ===============================
// LOGIN
// ===============================
export const customerOtpLoginService = async ({ identifier, dairyId }) => {
  const phoneVariants = buildPhoneVariants(identifier);
  const exactQuery = supabase
    .from("customers")
    .select("*")
    .in("phone_number", phoneVariants);

  const { data: exactCustomer } = await exactQuery.limit(1).maybeSingle();

  let customer = exactCustomer;

  if (!customer) {
    const loosePattern = buildLoosePhonePattern(identifier);
    if (loosePattern) {
      const looseQuery = supabase
        .from("customers")
        .select("*")
        .ilike("phone_number", loosePattern);

      const { data: looseCustomer } = await looseQuery.limit(1).maybeSingle();
      customer = looseCustomer;
    }
  }

  if (!customer) throw new Error("Customer not found");

  const token = generateToken({
    id: customer.id,
    email: customer.email ?? null,
    role: "CUSTOMER",
    dairyId,
  });

  return {
    token,
    role: "CUSTOMER",
    user: customer,
  };
};
