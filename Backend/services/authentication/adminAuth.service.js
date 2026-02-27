import bcrypt from "bcryptjs";
import { supabase } from "../../config/supabase.js";
import { generateToken } from "../../utils/jwt.js";
import { sendEmail } from "../../utils/email.js";

const adminResetOtpStore = new Map();
const adminResetOtpRequestStore = new Map();
const ADMIN_OTP_EXPIRY_MS = 10 * 60 * 1000;
const ADMIN_OTP_REQUEST_LIMIT = 3;
const ADMIN_OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;

const normalizeIdentifier = (identifier) => String(identifier || "").trim();

const isMissingColumnError = (error) => {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("column") && msg.includes("does not exist");
};

export const findAdminByIdentifier = async (identifier) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const isEmail = normalizedIdentifier.includes("@");
  const mobile = normalizedIdentifier.replace(/\D/g, "");

  if (!normalizedIdentifier) return null;

  if (isEmail) {
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .ilike("email", normalizedIdentifier)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (mobile.length >= 10) {
    const candidateColumns = ["phone", "phone_number"];
    for (const column of candidateColumns) {
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .eq(column, mobile)
        .limit(1)
        .maybeSingle();

      if (!error && data) return data;
      if (error && !isMissingColumnError(error)) throw error;
    }
  }

  return null;
};

const purgeExpiredAdminResetOtps = () => {
  const now = Date.now();
  for (const [key, value] of adminResetOtpStore.entries()) {
    if (!value?.expiresAt || value.expiresAt <= now) {
      adminResetOtpStore.delete(key);
    }
  }
};

const trackAdminOtpRequest = (key) => {
  const now = Date.now();
  const existing = adminResetOtpRequestStore.get(key);
  const isExpiredWindow = !existing || now - existing.windowStart > ADMIN_OTP_REQUEST_WINDOW_MS;

  if (isExpiredWindow) {
    adminResetOtpRequestStore.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remainingRequests: ADMIN_OTP_REQUEST_LIMIT - 1,
    };
  }

  if (existing.count >= ADMIN_OTP_REQUEST_LIMIT) {
    return {
      allowed: false,
      remainingRequests: 0,
    };
  }

  const nextCount = existing.count + 1;
  adminResetOtpRequestStore.set(key, { ...existing, count: nextCount });
  return {
    allowed: true,
    remainingRequests: Math.max(0, ADMIN_OTP_REQUEST_LIMIT - nextCount),
  };
};

export const requestAdminResetOtpService = async ({ identifier }) => {
  const admin = await findAdminByIdentifier(identifier);
  if (!admin) throw new Error("Admin account not found");
  if (!admin.email) throw new Error("Admin email not available for OTP delivery");

  purgeExpiredAdminResetOtps();
  const requestCheck = trackAdminOtpRequest(String(admin.id));
  if (!requestCheck.allowed) {
    const err = new Error("OTP request limit exceeded. Try after 15 minutes.");
    err.statusCode = 429;
    err.remainingRequests = 0;
    err.retryAfterMinutes = 15;
    throw err;
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const key = String(admin.id);
  adminResetOtpStore.set(key, {
    otp,
    expiresAt: Date.now() + ADMIN_OTP_EXPIRY_MS,
  });

  await sendEmail({
    to: admin.email,
    subject: "DairyStream Admin Password Reset OTP",
    html: `
      <p>Your OTP for admin password reset is:</p>
      <h2>${otp}</h2>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });

  return {
    email: admin.email,
    remainingRequests: requestCheck.remainingRequests,
    limit: ADMIN_OTP_REQUEST_LIMIT,
  };
};

export const resetAdminPasswordWithOtpService = async ({
  identifier,
  otp,
  newPassword,
}) => {
  const normalizedOtp = String(otp || "").trim();
  const normalizedPassword = String(newPassword || "");

  if (!normalizedOtp) throw new Error("OTP is required");
  if (normalizedPassword.length < 6) {
    throw new Error("New password must be at least 6 characters");
  }

  const admin = await findAdminByIdentifier(identifier);
  if (!admin) throw new Error("Admin account not found");

  purgeExpiredAdminResetOtps();
  const key = String(admin.id);
  const otpRecord = adminResetOtpStore.get(key);

  if (!otpRecord || otpRecord.expiresAt <= Date.now()) {
    adminResetOtpStore.delete(key);
    throw new Error("OTP expired or not found");
  }
  if (String(otpRecord.otp) !== normalizedOtp) throw new Error("Invalid OTP");

  const hashedPassword = await bcrypt.hash(normalizedPassword, 10);
  const { error } = await supabase
    .from("admins")
    .update({ password: hashedPassword })
    .eq("id", admin.id);
  if (error) throw error;

  adminResetOtpStore.delete(key);
  return { success: true };
};

// ===============================
// ADMIN / STAFF LOGIN SERVICE
// ===============================
export const adminStaffLoginService = async ({ identifier, password }) => {
  const normalizedIdentifier = String(identifier || "").trim();
  const isAgentId = normalizedIdentifier.toUpperCase().startsWith("STF");

  let user = null;
  let role = null;

  if (isAgentId) {
    const { data: agentUser, error } = await supabase
      .from("agents")
      .select("*")
      .ilike("agent_id", normalizedIdentifier.toUpperCase())
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    user = agentUser;
    role = "STAFF";
  } else {
    user = await findAdminByIdentifier(normalizedIdentifier);

    role = "ADMIN";
  }

  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new Error("Incorrect Password");
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    role,
    dairyId: user.dairy_id,
  });

  return {
    token,
    role,
    user: {
      id: user.id,
      name: user.name || user.email,
      email: user.email,
    },
  };
};
