import bcrypt from "bcryptjs";
import { supabase } from "../../config/supabase.js";
import { issueLoginTokens } from "../../utils/jwt.js";
import { ensureIdentityIsUnique } from "../authentication/identityUniqueness.service.js";
import verifyEmail from "../../utils/verifyEmail.js";
import {
  buildVerificationResetFields,
  encryptAccountNumber,
  maskAccountNumber,
  normalizeAccountNumber,
  resolveStoredAccountNumber,
  serializeDairyBankFields,
} from "../../utils/bankAccountSecurity.js";

const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const normalizeIfsc = (value) => String(value || "").trim().toUpperCase();
const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");
const normalizeString = (value) => String(value || "").trim();
const formatAdminIdentityConflictMessage = (conflict = {}) => {
  const issues = [];

  if (conflict.emailTakenBy) {
    issues.push("Admin email is already used");
  }

  if (conflict.phoneTakenBy) {
    issues.push("Admin mobile number is already used");
  }

  if (issues.length === 0) {
    return "Admin identity details are already in use";
  }

  return `${issues.join(" and ")}. Please use different admin credentials.`;
};

// ===============================
// REGISTER DAIRY SERVICE
// ===============================
// ===============================
// REGISTER DAIRY SERVICE (FIXED)
// ===============================
export const registerDairyService = async ({
  dairy_name,
  dairy_phone,
  dairy_email,
  gstin,
  category,
  address,
  city,
  state,
  pincode,
  latitude,
  longitude,
  service_type,
  service_pincodes,
  service_radius,
  owner_name,
  admin_email,
  adminMobile,
  password,
  selected_plan,
  bank_account_holder_name,
  bank_account_number,
  bank_ifsc_code, // ✅ Corrected name here
  bank_name,
  bank_branch,
  upi_id,
  razorpay_linked_account_id,
  imageUrl,
}) => {
  try {
    const normalizedDairyEmail = normalizeEmail(dairy_email);
    const normalizedAdminEmail = normalizeEmail(admin_email);
    
    // Use the exact names from the arguments above
    const sanitizedAccountNumber = normalizeDigits(bank_account_number);
    const sanitizedIfsc = normalizeIfsc(bank_ifsc_code); // ✅ No longer undefined

    // 1. Validation Logic
    if (
      sanitizedAccountNumber &&
      (sanitizedAccountNumber.length < 8 || sanitizedAccountNumber.length > 20)
    ) {
      const inputError = new Error("Bank account number must be between 8 and 20 digits");
      inputError.statusCode = 400;
      throw inputError;
    }

    if (sanitizedIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(sanitizedIfsc)) {
      const inputError = new Error("Invalid IFSC code format");
      inputError.statusCode = 400;
      throw inputError;
    }

    // 2. Uniqueness Checks
    const { data: existingDairyByEmail } = await supabase
      .from("dairies")
      .select("id")
      .ilike("dairy_email", normalizedDairyEmail)
      .maybeSingle();

    if (existingDairyByEmail) {
      const conflictError = new Error("Dairy email is already registered");
      conflictError.statusCode = 409;
      throw conflictError;
    }

    // 3. Insert Dairy
    const { data: dairyData, error: dairyError } = await supabase
      .from("dairies")
      .insert({
        dairy_name,
        dairy_phone,
        dairy_email: normalizedDairyEmail,
        image_url: imageUrl || null,
        gstin,
        category,
        address,
        city,
        state,
        pincode,
        latitude: parseFloat(latitude) || null,
        longitude: parseFloat(longitude) || null,
        service_type,
        service_pincodes,
        service_radius: parseFloat(service_radius) || 10,
        owner_name,
        selected_plan,
        status: "ACTIVE",
        bank_account_holder_name: String(bank_account_holder_name || "").trim() || null,
        bank_account_number: process.env.BANK_ACCOUNT_ENCRYPTION_KEY || process.env.BANK_VERIFICATION_ENCRYPTION_KEY
          ? null
          : sanitizedAccountNumber || null,
        bank_account_number_encrypted: encryptAccountNumber(sanitizedAccountNumber),
        masked_account_number: maskAccountNumber(sanitizedAccountNumber) || null,
        bank_ifsc_code: sanitizedIfsc || null,
        bank_name: String(bank_name || "").trim() || null,
        bank_branch: String(bank_branch || "").trim() || null,
        upi_id: String(upi_id || "").trim() || null,
        payment_verification_mode: "MANUAL",
        payments_enabled: false,
        bank_verified: false,
        bank_verification_status: sanitizedAccountNumber && sanitizedIfsc ? "PENDING_VERIFICATION" : "NOT_SUBMITTED",
      })
      .select()
      .single();

    if (dairyError) throw new Error(`Failed to create dairy: ${dairyError.message}`);

    // 4. Create Admin Account
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: adminData, error: adminError } = await supabase
      .from("admins")
      .insert({
        dairy_id: dairyData.id,
        email: normalizedAdminEmail,
        password: hashedPassword,
        name: owner_name,
        phone: adminMobile,
        role: "ADMIN",
        status: "ACTIVE",
      })
      .select()
      .single();

    if (adminError) {
      await supabase.from("dairies").delete().eq("id", dairyData.id); // Rollback
      throw new Error(`Failed to create admin: ${adminError.message}`);
    }

    const tokens = await issueLoginTokens({
      id: adminData.id,
      email: adminData.email,
      role: "ADMIN",
      dairyId: dairyData.id,
      actorType: "ADMIN",
    });

    return {
      success: true,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresIn: tokens.accessTokenExpiresIn,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      dairy: dairyData,
      admin: { id: adminData.id, email: adminData.email, name: adminData.name },
    };
  } catch (err) {
    console.error("❌ Dairy registration service error:", err.message);
    throw err;
  }
};

export const getAdminDairyProfileService = async ({ adminId, dairyId, revealBankDetails = false }) => {
  const normalizedDairyId = Number(dairyId);
  if (!Number.isFinite(normalizedDairyId) || normalizedDairyId <= 0) {
    const err = new Error("Valid dairy is required");
    err.statusCode = 400;
    throw err;
  }

  const [dairyResponse, adminResponse] = await Promise.all([
    supabase
      .from("dairies")
      .select(
        "id, dairy_name, dairy_phone, dairy_email, address, city, state, pincode, owner_name, selected_plan, bank_account_holder_name, bank_account_number, bank_account_number_encrypted, masked_account_number, bank_ifsc_code, bank_name, bank_branch, upi_id, payment_instructions, upi_qr_enabled, bank_transfer_enabled, payment_verification_mode, payments_enabled, bank_verified, verification_provider, verification_reference_id, bank_verification_status, bank_verification_timestamp, account_name_match_score, bank_metadata, verified_account_holder_name, verified_upi_id, account_verification_response, verification_attempts, verification_last_error, verification_method, vpa_detected, vpa_verified, bank_verification_reset_at, verification_required, account_last_updated_at"
      )
      .eq("id", normalizedDairyId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("admins")
      .select("id, name, email, phone, role, status")
      .eq("id", adminId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (dairyResponse.error) {
    throw new Error(`Failed to read dairy profile: ${dairyResponse.error.message}`);
  }
  if (adminResponse.error) {
    throw new Error(`Failed to read admin profile: ${adminResponse.error.message}`);
  }
  if (!dairyResponse.data) {
    const err = new Error("Dairy not found");
    err.statusCode = 404;
    throw err;
  }

  return {
    dairy: serializeDairyBankFields(dairyResponse.data, {
      revealAccountNumber: Boolean(revealBankDetails),
    }),
    admin: adminResponse.data || null,
  };
};

export const updateAdminDairyProfileService = async ({
  adminId,
  dairyId,
  payload = {},
}) => {
  const normalizedDairyId = Number(dairyId);
  if (!Number.isFinite(normalizedDairyId) || normalizedDairyId <= 0) {
    const err = new Error("Valid dairy is required");
    err.statusCode = 400;
    throw err;
  }

  const rawAccountNumber = String(payload.bank_account_number || "").trim();
  const payloadAccountIsMasked = /X/i.test(rawAccountNumber);
  let sanitizedAccountNumber = payloadAccountIsMasked ? "" : normalizeDigits(rawAccountNumber);
  const sanitizedIfsc = normalizeIfsc(payload.bank_ifsc_code);

  if (
    !payloadAccountIsMasked &&
    sanitizedAccountNumber &&
    (sanitizedAccountNumber.length < 8 || sanitizedAccountNumber.length > 20)
  ) {
    const err = new Error("Bank account number must be between 8 and 20 digits");
    err.statusCode = 400;
    throw err;
  }

  if (sanitizedIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(sanitizedIfsc)) {
    const err = new Error("Invalid IFSC code format");
    err.statusCode = 400;
    throw err;
  }

  const { data: existingDairy, error: existingError } = await supabase
    .from("dairies")
    .select("id, bank_account_holder_name, bank_account_number, bank_account_number_encrypted, bank_ifsc_code, bank_verified")
    .eq("id", normalizedDairyId)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to read dairy profile: ${existingError.message}`);
  }
  if (!existingDairy) {
    const err = new Error("Dairy not found");
    err.statusCode = 404;
    throw err;
  }

  if (payloadAccountIsMasked) {
    sanitizedAccountNumber = resolveStoredAccountNumber(existingDairy);
  }

  const bankDetailsChanged =
    resolveStoredAccountNumber(existingDairy) !== sanitizedAccountNumber ||
    normalizeIfsc(existingDairy.bank_ifsc_code) !== sanitizedIfsc;
  const timestamp = new Date().toISOString();
  const encryptedAccountNumber = encryptAccountNumber(sanitizedAccountNumber);

  const dairyUpdate = {
    dairy_name: normalizeString(payload.dairy_name),
    dairy_phone: normalizeString(payload.dairy_phone),
    dairy_email: normalizeEmail(payload.dairy_email),
    address: normalizeString(payload.address),
    city: normalizeString(payload.city),
    state: normalizeString(payload.state),
    pincode: normalizeDigits(payload.pincode),
    owner_name: normalizeString(payload.owner_name),
    bank_account_holder_name: normalizeString(payload.bank_account_holder_name) || null,
    bank_account_number: encryptedAccountNumber ? null : sanitizedAccountNumber || null,
    bank_account_number_encrypted: encryptedAccountNumber,
    masked_account_number: maskAccountNumber(sanitizedAccountNumber) || null,
    bank_ifsc_code: sanitizedIfsc || null,
    bank_name: normalizeString(payload.bank_name) || null,
    bank_branch: normalizeString(payload.bank_branch) || null,
    upi_id: normalizeString(payload.upi_id) || null,
    payment_instructions: normalizeString(payload.payment_instructions) || null,
    upi_qr_enabled: payload.upi_qr_enabled === undefined ? true : Boolean(payload.upi_qr_enabled),
    bank_transfer_enabled:
      payload.bank_transfer_enabled === undefined ? true : Boolean(payload.bank_transfer_enabled),
    payment_verification_mode: "MANUAL",
    payments_enabled: Boolean(existingDairy.bank_verified) && !bankDetailsChanged,
    account_last_updated_at: bankDetailsChanged ? timestamp : undefined,
    ...(bankDetailsChanged
      ? buildVerificationResetFields({
          hasBankDetails: Boolean(sanitizedAccountNumber && sanitizedIfsc),
          timestamp,
        })
      : {}),
    updated_at: timestamp,
  };

  const { data: dairy, error: dairyError } = await supabase
    .from("dairies")
    .update(dairyUpdate)
    .eq("id", normalizedDairyId)
    .select(
      "id, dairy_name, dairy_phone, dairy_email, address, city, state, pincode, owner_name, selected_plan, bank_account_holder_name, bank_account_number, bank_account_number_encrypted, masked_account_number, bank_ifsc_code, bank_name, bank_branch, upi_id, payment_instructions, upi_qr_enabled, bank_transfer_enabled, payment_verification_mode, payments_enabled, bank_verified, verification_provider, verification_reference_id, bank_verification_status, bank_verification_timestamp, account_name_match_score, bank_metadata, verified_account_holder_name, verified_upi_id, account_verification_response, verification_attempts, verification_last_error, verification_method, vpa_detected, vpa_verified, bank_verification_reset_at, verification_required, account_last_updated_at"
    )
    .single();

  if (dairyError) {
    throw new Error(`Failed to update dairy profile: ${dairyError.message}`);
  }

  const adminUpdate = {
    name: normalizeString(payload.owner_name) || normalizeString(payload.admin_name) || undefined,
    email: normalizeEmail(payload.admin_email),
    phone: normalizeDigits(payload.admin_phone),
  };
  const cleanAdminUpdate = Object.fromEntries(
    Object.entries(adminUpdate).filter(([, value]) => value !== undefined && value !== "")
  );

  let admin = null;
  if (Object.keys(cleanAdminUpdate).length > 0 && adminId) {
    const { data: adminData, error: adminError } = await supabase
      .from("admins")
      .update(cleanAdminUpdate)
      .eq("id", adminId)
      .select("id, name, email, phone, role, status")
      .maybeSingle();

    if (adminError) {
      throw new Error(`Failed to update admin profile: ${adminError.message}`);
    }
    admin = adminData;
  }

  return {
    dairy: serializeDairyBankFields(dairy, { revealAccountNumber: false }),
    admin,
  };
};
