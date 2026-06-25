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
import {
  createLinkedAccount,
  createStakeholder,
  requestRouteProduct,
  updateRouteSettlementConfig,
} from "../marketplace/razorpayRoute.service.js";
import { encryptDeterministic, decryptDeterministic } from "../../utils/crypto.js";

export const decryptDairyFields = (dairy) => {
  if (!dairy) return dairy;
  return {
    ...dairy,
    dairy_phone: decryptDeterministic(dairy.dairy_phone),
    dairy_email: decryptDeterministic(dairy.dairy_email),
    phone: decryptDeterministic(dairy.phone),
    email: decryptDeterministic(dairy.email),
    bank_ifsc_code: decryptDeterministic(dairy.bank_ifsc_code),
    ifsc: decryptDeterministic(dairy.ifsc),
    pan: decryptDeterministic(dairy.pan),
    bank_branch: decryptDeterministic(dairy.bank_branch),
  };
};

const normalizeString = (value) => String(value || "").trim();
const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const normalizeIfsc = (value) => String(value || "").trim().toUpperCase();
const normalizeDigits = (value) => String(value || "").replace(/\D/g, "");
const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase() === "true";
};
const normalizePaymentMethod = ({
  method,
  acceptDirectUpi,
  acceptRazorpay,
  fallback = "DIRECT_UPI",
} = {}) => {
  const normalized = String(method || "").trim().toUpperCase();
  if (["DIRECT_UPI", "UPI", "DIRECT_UPI_QR"].includes(normalized)) return "DIRECT_UPI";
  if (["RAZORPAY", "PAY_NOW", "ONLINE_PAYMENT"].includes(normalized)) return "RAZORPAY";

  const directEnabled = parseBoolean(acceptDirectUpi, false);
  const razorpayEnabled = parseBoolean(acceptRazorpay, false);
  if (directEnabled && razorpayEnabled) {
    const inputError = new Error("Choose only one payment method for each payment purpose");
    inputError.statusCode = 400;
    throw inputError;
  }
  if (razorpayEnabled) return "RAZORPAY";
  if (directEnabled) return "DIRECT_UPI";

  return fallback;
};
const RAZORPAY_CHARGE_PERCENT = 2;
const RAZORPAY_GST_PERCENT_ON_CHARGE = 18;
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
  one_time_payment_method,
  subscription_payment_method,
  one_time_accept_direct_upi,
  one_time_accept_razorpay,
  subscription_accept_direct_upi,
  subscription_accept_razorpay,
  imageUrl,
}) => {
  try {
    const normalizedDairyEmail = normalizeEmail(dairy_email);
    const normalizedAdminEmail = normalizeEmail(admin_email);
    
    // Use the exact names from the arguments above
    const sanitizedAccountNumber = normalizeDigits(bank_account_number);
    const sanitizedIfsc = normalizeIfsc(bank_ifsc_code); // ✅ No longer undefined
    const normalizedUpiId = String(upi_id || "").trim();
    const normalizedRazorpayLinkedAccountId =
      String(razorpay_linked_account_id || "").trim() || null;
    const oneTimePaymentMethod = normalizePaymentMethod({
      method: one_time_payment_method,
      acceptDirectUpi: one_time_accept_direct_upi,
      acceptRazorpay: one_time_accept_razorpay,
      fallback: "DIRECT_UPI",
    });
    const subscriptionPaymentMethod = normalizePaymentMethod({
      method: subscription_payment_method,
      acceptDirectUpi: subscription_accept_direct_upi,
      acceptRazorpay: subscription_accept_razorpay,
      fallback: "DIRECT_UPI",
    });
    const paymentSettings = {
      oneTimePaymentMethod,
      subscriptionPaymentMethod,
      oneTimeAcceptDirectUpi: oneTimePaymentMethod === "DIRECT_UPI",
      oneTimeAcceptRazorpay: oneTimePaymentMethod === "RAZORPAY",
      subscriptionAcceptDirectUpi: subscriptionPaymentMethod === "DIRECT_UPI",
      subscriptionAcceptRazorpay: subscriptionPaymentMethod === "RAZORPAY",
    };

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

    if (
      !paymentSettings.oneTimeAcceptDirectUpi &&
      !paymentSettings.oneTimeAcceptRazorpay
    ) {
      const inputError = new Error("Select at least one payment option for one-time orders");
      inputError.statusCode = 400;
      throw inputError;
    }

    if (
      !paymentSettings.subscriptionAcceptDirectUpi &&
      !paymentSettings.subscriptionAcceptRazorpay
    ) {
      const inputError = new Error("Select at least one payment option for monthly subscription");
      inputError.statusCode = 400;
      throw inputError;
    }

    if (
      (paymentSettings.oneTimeAcceptDirectUpi ||
        paymentSettings.subscriptionAcceptDirectUpi) &&
      !normalizedUpiId
    ) {
      const inputError = new Error("UPI ID is required when Direct UPI QR is enabled");
      inputError.statusCode = 400;
      throw inputError;
    }

    if (
      (paymentSettings.oneTimeAcceptRazorpay ||
        paymentSettings.subscriptionAcceptRazorpay) &&
      !normalizedRazorpayLinkedAccountId
    ) {
      const inputError = new Error("Razorpay linked account id is required when Razorpay is enabled");
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
        dairy_phone: encryptDeterministic(dairy_phone),
        dairy_email: encryptDeterministic(normalizedDairyEmail),
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
        bank_ifsc_code: encryptDeterministic(sanitizedIfsc) || null,
        ifsc: encryptDeterministic(sanitizedIfsc) || null,
        bank_name: String(bank_name || "").trim() || null,
        bank_branch: encryptDeterministic(String(bank_branch || "").trim()) || null,
        upi_id: String(upi_id || "").trim() || null,
        razorpay_linked_account_id: normalizedRazorpayLinkedAccountId,
        one_time_payment_method: paymentSettings.oneTimePaymentMethod,
        subscription_payment_method: paymentSettings.subscriptionPaymentMethod,
        one_time_accept_direct_upi: paymentSettings.oneTimeAcceptDirectUpi,
        one_time_accept_razorpay: paymentSettings.oneTimeAcceptRazorpay,
        subscription_accept_direct_upi: paymentSettings.subscriptionAcceptDirectUpi,
        subscription_accept_razorpay: paymentSettings.subscriptionAcceptRazorpay,
        direct_upi_proof_requirement: "SCREENSHOT_OR_REFERENCE_ID",
        razorpay_charge_percent: RAZORPAY_CHARGE_PERCENT,
        razorpay_gst_percent_on_charge: RAZORPAY_GST_PERCENT_ON_CHARGE,
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
        email: encryptDeterministic(normalizedAdminEmail),
        password: hashedPassword,
        name: owner_name,
        phone: encryptDeterministic(adminMobile),
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
      email: decryptDeterministic(adminData.email),
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
      dairy: decryptDairyFields(dairyData),
      admin: { id: adminData.id, email: decryptDeterministic(adminData.email), name: adminData.name },
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
        "id, dairy_name, dairy_phone, dairy_email, address, city, state, pincode, owner_name, selected_plan, latitude, longitude, service_radius, bank_account_holder_name, bank_account_number, bank_account_number_encrypted, masked_account_number, bank_ifsc_code, bank_name, bank_branch, upi_id, payment_instructions, upi_qr_enabled, bank_transfer_enabled, payment_verification_mode, payments_enabled, bank_verified, verification_provider, verification_reference_id, bank_verification_status, bank_verification_timestamp, account_name_match_score, bank_metadata, verified_account_holder_name, verified_upi_id, account_verification_response, verification_attempts, verification_last_error, verification_method, vpa_detected, vpa_verified, bank_verification_reset_at, verification_required, account_last_updated_at, pan, one_time_accept_direct_upi, one_time_accept_razorpay, subscription_accept_direct_upi, subscription_accept_razorpay"
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

  if (adminResponse.data) {
    adminResponse.data.email = decryptDeterministic(adminResponse.data.email);
    adminResponse.data.phone = decryptDeterministic(adminResponse.data.phone);
  }

  const dairy = serializeDairyBankFields(decryptDairyFields(dairyResponse.data), {
    revealAccountNumber: Boolean(revealBankDetails),
  });
  if (dairy) {
    dairy.one_time_payment_method = dairyResponse.data.one_time_accept_razorpay ? "RAZORPAY" : "DIRECT_UPI";
    dairy.subscription_payment_method = dairyResponse.data.subscription_accept_razorpay ? "RAZORPAY" : "DIRECT_UPI";
  }

  return {
    dairy,
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
    .select("id, dairy_name, owner_name, dairy_email, dairy_phone, address, city, state, pincode, bank_account_holder_name, bank_account_number, bank_account_number_encrypted, bank_ifsc_code, ifsc, pan, bank_branch, bank_verified, razorpay_linked_account_id, razorpay_route_product_id")
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
    normalizeIfsc(decryptDeterministic(existingDairy.bank_ifsc_code)) !== sanitizedIfsc;
  const timestamp = new Date().toISOString();
  const encryptedAccountNumber = encryptAccountNumber(sanitizedAccountNumber);

  // AUTOMATION: If bank details changed/added (or no linked account exists yet) and PAN is provided, onboard to Razorpay Route
  const hasLinkedAccount = Boolean(existingDairy.razorpay_linked_account_id);
  const shouldOnboard = (bankDetailsChanged || !hasLinkedAccount) && sanitizedAccountNumber && sanitizedIfsc && payload.pan;

  let razorpayOnboarding = {};
  if (shouldOnboard) {
    try {
      const account = await createLinkedAccount({
        dairyId: normalizedDairyId,
        dairyName: normalizeString(payload.dairy_name) || existingDairy.dairy_name,
        ownerName: normalizeString(payload.owner_name) || existingDairy.owner_name,
        email: normalizeEmail(payload.dairy_email) || decryptDeterministic(existingDairy.dairy_email),
        phone: normalizeDigits(payload.dairy_phone) || decryptDeterministic(existingDairy.dairy_phone),
        pan: normalizeString(payload.pan),
        address: normalizeString(payload.address) || existingDairy.address,
        city: normalizeString(payload.city) || existingDairy.city || "NA",
        state: normalizeString(payload.state) || existingDairy.state || "NA",
        pincode: normalizeDigits(payload.pincode) || existingDairy.pincode || "000000",
      });

      const stakeholder = await createStakeholder({
        accountId: account.id,
        ownerName: normalizeString(payload.owner_name) || existingDairy.owner_name,
        email: normalizeEmail(payload.dairy_email) || decryptDeterministic(existingDairy.dairy_email),
        phone: normalizeDigits(payload.dairy_phone) || decryptDeterministic(existingDairy.dairy_phone),
        pan: normalizeString(payload.pan),
        address: normalizeString(payload.address) || existingDairy.address,
        city: normalizeString(payload.city) || existingDairy.city || "NA",
        state: normalizeString(payload.state) || existingDairy.state || "NA",
        pincode: normalizeDigits(payload.pincode) || existingDairy.pincode || "000000",
      });

      const product = await requestRouteProduct(account.id);
      const productId = product?.id;

      if (productId) {
        await updateRouteSettlementConfig({
          accountId: account.id,
          productId,
          accountNumber: sanitizedAccountNumber,
          ifsc: sanitizedIfsc,
          beneficiaryName: normalizeString(payload.bank_account_holder_name) || normalizeString(payload.owner_name) || "Owner",
        });
      }

      razorpayOnboarding = {
        pan: encryptDeterministic(normalizeString(payload.pan)),
        razorpay_account_id: account.id,
        razorpay_linked_account_id: account.id,
        razorpay_stakeholder_id: stakeholder?.id || null,
        razorpay_route_product_id: productId || null,
        route_activation_status: "ACTIVATED",
        payments_enabled: true,
      };
    } catch (err) {
      console.error("Auto-onboarding to Razorpay Route failed:", err.message);
      if (err.response?.data) {
        console.error("Razorpay API Error Payload:", JSON.stringify(err.response.data, null, 2));
      }
      razorpayOnboarding = {
        pan: encryptDeterministic(normalizeString(payload.pan)),
        route_activation_status: "RAZORPAY_SETUP_FAILED",
      };
    }
  } else if (payload.pan) {
    razorpayOnboarding = {
      pan: encryptDeterministic(normalizeString(payload.pan)),
    };
  }

  const dairyUpdate = {
    dairy_name: normalizeString(payload.dairy_name),
    dairy_phone: payload.dairy_phone ? encryptDeterministic(normalizeString(payload.dairy_phone)) : undefined,
    dairy_email: payload.dairy_email ? encryptDeterministic(normalizeEmail(payload.dairy_email)) : undefined,
    address: normalizeString(payload.address),
    city: normalizeString(payload.city),
    state: normalizeString(payload.state),
    pincode: normalizeDigits(payload.pincode),
    owner_name: normalizeString(payload.owner_name),
    bank_account_holder_name: normalizeString(payload.bank_account_holder_name) || null,
    bank_account_number: encryptedAccountNumber ? null : sanitizedAccountNumber || null,
    bank_account_number_encrypted: encryptedAccountNumber,
    masked_account_number: maskAccountNumber(sanitizedAccountNumber) || null,
    bank_ifsc_code: sanitizedIfsc ? encryptDeterministic(sanitizedIfsc) : null,
    ifsc: sanitizedIfsc ? encryptDeterministic(sanitizedIfsc) : null,
    bank_name: normalizeString(payload.bank_name) || null,
    bank_branch: payload.bank_branch ? encryptDeterministic(normalizeString(payload.bank_branch)) : null,
    upi_id: normalizeString(payload.upi_id) || null,
    payment_instructions: normalizeString(payload.payment_instructions) || null,
    upi_qr_enabled: payload.upi_qr_enabled === undefined ? true : Boolean(payload.upi_qr_enabled),
    bank_transfer_enabled:
      payload.bank_transfer_enabled === undefined ? true : Boolean(payload.bank_transfer_enabled),
    one_time_accept_direct_upi: payload.one_time_payment_method ? (payload.one_time_payment_method === "DIRECT_UPI") : undefined,
    one_time_accept_razorpay: payload.one_time_payment_method ? (payload.one_time_payment_method === "RAZORPAY") : undefined,
    subscription_accept_direct_upi: payload.subscription_payment_method ? (payload.subscription_payment_method === "DIRECT_UPI") : undefined,
    subscription_accept_razorpay: payload.subscription_payment_method ? (payload.subscription_payment_method === "RAZORPAY") : undefined,
    payment_verification_mode: "MANUAL",
    payments_enabled: Boolean(existingDairy.bank_verified) && !bankDetailsChanged,
    account_last_updated_at: bankDetailsChanged ? timestamp : undefined,
    ...razorpayOnboarding,
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
      "id, dairy_name, dairy_phone, dairy_email, address, city, state, pincode, owner_name, selected_plan, bank_account_holder_name, bank_account_number, bank_account_number_encrypted, masked_account_number, bank_ifsc_code, bank_name, bank_branch, upi_id, payment_instructions, upi_qr_enabled, bank_transfer_enabled, payment_verification_mode, payments_enabled, bank_verified, verification_provider, verification_reference_id, bank_verification_status, bank_verification_timestamp, account_name_match_score, bank_metadata, verified_account_holder_name, verified_upi_id, account_verification_response, verification_attempts, verification_last_error, verification_method, vpa_detected, vpa_verified, bank_verification_reset_at, verification_required, account_last_updated_at, pan, one_time_accept_direct_upi, one_time_accept_razorpay, subscription_accept_direct_upi, subscription_accept_razorpay"
    )
    .single();

  if (dairyError) {
    throw new Error(`Failed to update dairy profile: ${dairyError.message}`);
  }

  const adminUpdate = {
    name: normalizeString(payload.owner_name) || normalizeString(payload.admin_name) || undefined,
    email: payload.admin_email ? encryptDeterministic(normalizeEmail(payload.admin_email)) : undefined,
    phone: payload.admin_phone ? encryptDeterministic(normalizeDigits(payload.admin_phone)) : undefined,
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

  if (admin) {
    admin.email = decryptDeterministic(admin.email);
    admin.phone = decryptDeterministic(admin.phone);
  }

  const serializedDairy = serializeDairyBankFields(decryptDairyFields(dairy), { revealAccountNumber: false });
  if (serializedDairy) {
    serializedDairy.one_time_payment_method = dairy.one_time_accept_razorpay ? "RAZORPAY" : "DIRECT_UPI";
    serializedDairy.subscription_payment_method = dairy.subscription_accept_razorpay ? "RAZORPAY" : "DIRECT_UPI";
  }

  return {
    dairy: serializedDairy,
    admin,
  };
};
