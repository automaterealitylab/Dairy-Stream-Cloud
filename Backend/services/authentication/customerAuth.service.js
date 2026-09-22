import { supabase } from "../../config/supabase.js";
import { getRedisConnection } from "../../config/redis.js";
import { issueLoginTokens } from "../../utils/jwt.js";
import bcrypt from "bcryptjs";
import cloudinary from "../../config/cloudinary.js";
import { ensureIdentityIsUnique } from "./identityUniqueness.service.js"; // Reuse existing uniqueness service
import verifyEmail from "../../utils/verifyEmail.js";
import { sendEmail } from "../../utils/email.js";
import { encryptDeterministic, decryptDeterministic } from "../../utils/crypto.js";
import { resolveOrCreateCustomerHierarchy } from "../propertyHierarchy/propertyHierarchy.service.js";
import { logger } from "../../utils/logger.js";

const normalizeIdentifier = (value) => String(value ?? "").trim();
const normalizeEmail = (value) => (value || "").trim().toLowerCase();
const otpStore = new Map();
const CUSTOMER_OTP_TTL_SECONDS = Number(process.env.CUSTOMER_OTP_TTL_SECONDS || 300);

// Helper: Build OTP Key
const buildOtpKey = (identifier, dairyId) =>
  `${normalizeIdentifier(identifier)}::${dairyId == null ? "null" : String(dairyId)}`;

const buildRedisOtpKey = (identifier, dairyId) => `otp:customer:${buildOtpKey(identifier, dairyId)}`;

const purgeExpiredCustomerOtps = () => {
  const now = Date.now();
  for (const [key, value] of otpStore.entries()) {
    if (!value?.expiresAt || value.expiresAt <= now) {
      otpStore.delete(key);
    }
  }
};

// Helper: Phone Variants
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

const isMissingRelationOrColumnError = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("column") && message.includes("does not exist"))
  );
};

const isMissingCustomerRegistrationLocationColumns = (error) => {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("address_line_1") ||
    message.includes("address_line_2") ||
    message.includes("latitude") ||
    message.includes("longitude")
  );
};

const findCustomerByIdentifier = async (identifier) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const isEmail = normalizedIdentifier.includes("@");
  const phoneVariants = buildPhoneVariants(normalizedIdentifier);

  let query = supabase
    .from("customers")
    .select("id, customer_name, email, phone_number");

  if (isEmail) {
    query = query.or(`email.eq.${encryptDeterministic(normalizedIdentifier)},email.eq.${normalizedIdentifier}`);
  } else {
    const searchVariants = [
      ...phoneVariants,
      ...phoneVariants.map((v) => encryptDeterministic(v)),
    ];
    query = query.in("phone_number", searchVariants);
  }

  const { data: customer, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
  if (customer) {
    customer.email = decryptDeterministic(customer.email);
    customer.phone_number = decryptDeterministic(customer.phone_number);
  }
  return customer || null;
};

const hasHistoryRow = async ({
  table,
  customerId,
  customerColumns = ["customer_id"],
  dairyId = null,
}) => {
  for (const customerColumn of customerColumns) {
    let query = supabase.from(table).select("id").eq(customerColumn, customerId);

    if (dairyId !== null && dairyId !== undefined && dairyId !== "") {
      query = query.eq("dairy_id", dairyId);
    }

    const { data, error } = await query.limit(1).maybeSingle();

    if (!error) return Boolean(data?.id);
    if (isMissingRelationOrColumnError(error)) continue;
    throw error;
  }

  return false;
};

// ==========================================
// CORE AUTH LOGIC
// ==========================================

/**
 * Register a new customer (Simplified: No Password/Photo)
 */
export const registerCustomerService = async (payload) => {
  const {
    customerName,
    email,
    phoneNumber,
    addressLine1,
    addressLine2,
    buildingName,
    wing,
    roomNo,
    latitude,
    longitude,
    defaultMilkQuantityLiters,
    billingCycle,
  } = payload;

  const normalizedEmail = normalizeEmail(email);

  const isEmailValid = await verifyEmail(normalizedEmail);
  if (!isEmailValid) {
    const validationError = new Error("Invalid or undeliverable email address");
    validationError.statusCode = 400;
    throw validationError;
  }

  // 1. Check Uniqueness (Email and Phone must be unique)
  await ensureIdentityIsUnique({ email: normalizedEmail, phone: phoneNumber });

  // 2. Resolve or create property hierarchy if provided
  let hierarchy = null;
  try {
    hierarchy = await resolveOrCreateCustomerHierarchy({
      propertyId: payload.propertyId || payload.property_id || null,
      propertyName: payload.propertyName || payload.property_name || "",
      buildingId: payload.buildingId || payload.building_id || null,
      buildingName: payload.buildingName || payload.building_name || buildingName || "",
      hasWing: Boolean(
        (payload.hasWing ?? payload.has_wing) ??
        (payload.wing || payload.wingName || payload.wing_name)
      ),
      wingId: payload.wingId || payload.wing_id || null,
      wingName: payload.wingName || payload.wing_name || payload.wing || wing || "",
      floorId: payload.floorId || payload.floor_id || null,
      floorName: payload.floorName || payload.floor_name || "",
      unitId: payload.unitId || payload.unit_id || null,
      unitType: payload.unitType || payload.unit_type || "Flat",
      unitNumber: payload.unitNumber || payload.unit_number || roomNo || "",
      address: [addressLine1, addressLine2].filter(Boolean).join(", "),
      latitude,
      longitude,
    });
  } catch (hErr) {
    console.warn("Property hierarchy resolution in registration fallback:", hErr?.message || hErr);
  }

  // 3. Build insert object with dual-write (both new relational fields and legacy columns)
  const resolvedRoomNo = hierarchy?.unitNumber || payload.unitNumber || payload.unit_number || roomNo;
  const resolvedBuildingName = hierarchy?.buildingName || buildingName || null;
  const resolvedWing = hierarchy?.wingName || wing || null;

  const fullInsertPayload = {
    customer_name: customerName,
    email: encryptDeterministic(normalizedEmail),
    phone_number: encryptDeterministic(phoneNumber),
    address_line_1: String(addressLine1 || "").trim() || null,
    address_line_2: String(addressLine2 || "").trim() || null,
    building_name: resolvedBuildingName,
    wing: resolvedWing,
    room_no: resolvedRoomNo,
    latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
    longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
    default_milk_quantity_liters: defaultMilkQuantityLiters || 1,
    billing_cycle: billingCycle || "Monthly",
    // New relational hierarchy columns
    property_id: hierarchy?.propertyId || null,
    building_id: hierarchy?.buildingId || null,
    wing_id: hierarchy?.wingId || null,
    floor_id: hierarchy?.floorId || null,
    unit_id: hierarchy?.unitId || null,
    property_name: hierarchy?.propertyName || payload.propertyName || payload.property_name || null,
    floor_name: hierarchy?.floorName || payload.floorName || payload.floor_name || null,
    unit_type: hierarchy?.unitType || payload.unitType || payload.unit_type || "Flat",
    unit_number: resolvedRoomNo || null,
  };

  let { data, error } = await supabase
    .from("customers")
    .insert([fullInsertPayload])
    .select()
    .single();

  // If insert fails because new columns do not exist in DB yet, fallback gracefully to legacy columns only
  if (error && isMissingRelationOrColumnError(error)) {
    console.warn("Retrying customer insert without new hierarchy columns due to schema cache miss:", error.message);
    const legacyPayload = {
      customer_name: customerName,
      email: encryptDeterministic(normalizedEmail),
      phone_number: encryptDeterministic(phoneNumber),
      address_line_1: String(addressLine1 || "").trim() || null,
      address_line_2: String(addressLine2 || "").trim() || null,
      building_name: resolvedBuildingName,
      wing: resolvedWing,
      room_no: resolvedRoomNo,
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
      default_milk_quantity_liters: defaultMilkQuantityLiters || 1,
      billing_cycle: billingCycle || "Monthly",
    };
    const retry = await supabase.from("customers").insert([legacyPayload]).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("Supabase Error:", error.message);
    if (isMissingCustomerRegistrationLocationColumns(error)) {
      throw new Error(
        "Customer location fields are not ready in the database. Run the updated SUPABASE_MIGRATIONS.sql and try again."
      );
    }
    throw new Error(error.message);
  }

  if (data) {
    data.email = decryptDeterministic(data.email);
    data.phone_number = decryptDeterministic(data.phone_number);
  }
  return data;
};
/**
 * Login with Password
 */
export const loginWithPasswordService = async (emailOrPhone, password) => {
  const normalizedIdentifier = normalizeIdentifier(emailOrPhone);
  const isEmail = normalizedIdentifier.includes("@");
  const selectColumns =
    "id, customer_name, name, email, phone_number, password, dairy_id, is_active";

  let query = supabase.from("customers").select(selectColumns);
  if (isEmail) {
    query = query.or(`email.eq.${encryptDeterministic(normalizeEmail(normalizedIdentifier))},email.eq.${normalizeEmail(normalizedIdentifier)}`);
  } else {
    const phoneVariants = buildPhoneVariants(normalizedIdentifier);
    const searchVariants = [
      ...phoneVariants,
      ...phoneVariants.map((v) => encryptDeterministic(v)),
    ];
    query = query.in("phone_number", searchVariants);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) throw new Error("Database error");
  if (!data) throw new Error("Customer not found");
  if (!data.password) throw new Error("Password not set for this account");

  const isMatch = await bcrypt.compare(password, data.password);
  if (!isMatch) throw new Error("Invalid password");

  if (data) {
    data.email = decryptDeterministic(data.email);
    data.phone_number = decryptDeterministic(data.phone_number);
  }

  const tokens = await issueLoginTokens({
    id: data.id,
    email: data.email,
    role: "CUSTOMER",
    dairyId: data.dairy_id ?? null,
    actorType: "CUSTOMER",
  });

  return {
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    user: data,
  };
};

// ==========================================
// OTP LOGIC (Existing + Refined)
// ==========================================

const sendCustomerOtpEmail = async ({ customer, otp }) => {
  const text = `Your DairyStream customer login OTP is: ${otp}\n\nThis OTP is valid for 5 minutes.\nIf you did not request this OTP, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2C1A0E; margin-top: 0;">DairyStream Verification</h2>
      <p style="color: #555; font-size: 16px;">Your one-time password (OTP) for customer login is:</p>
      <div style="background-color: #f8f4f0; padding: 12px 20px; border-radius: 6px; font-size: 28px; font-weight: bold; letter-spacing: 4px; color: #B8641A; text-align: center; margin: 20px 0;">
        ${otp}
      </div>
      <p style="color: #666; font-size: 14px;">This OTP is valid for <strong>5 minutes</strong>.</p>
      <p style="color: #999; font-size: 12px; margin-top: 30px;">If you did not request this OTP, please ignore this email.</p>
    </div>
  `;

  await sendEmail({
    to: customer.email,
    subject: "DairyStream Customer Login OTP",
    text,
    html,
  });
};

const setCustomerOtpRecord = async ({ identifier, dairyId, otp, expiresAt }) => {
  const redis = getRedisConnection();
  const record = {
    identifier: normalizeIdentifier(identifier),
    dairy_id: dairyId ?? null,
    otp,
    expiresAt,
  };

  if (redis) {
    try {
      await redis.set(
        buildRedisOtpKey(identifier, dairyId),
        JSON.stringify(record),
        "EX",
        CUSTOMER_OTP_TTL_SECONDS
      );
      return;
    } catch (err) {
      logger.warn("redis_set_otp_failed_using_memory_fallback", { error: err.message });
    }
  }

  otpStore.set(buildOtpKey(identifier, dairyId), record);
};

const getCustomerOtpRecord = async ({ identifier, dairyId }) => {
  const redis = getRedisConnection();
  const key = buildOtpKey(identifier, dairyId);

  if (redis) {
    try {
      const value = await redis.get(buildRedisOtpKey(identifier, dairyId));
      if (!value) return null;
      return { key, redisKey: buildRedisOtpKey(identifier, dairyId), ...JSON.parse(value) };
    } catch (err) {
      logger.warn("redis_get_otp_failed_using_memory_fallback", { error: err.message });
    }
  }

  const value = otpStore.get(key);
  return value ? { key, ...value } : null;
};

const deleteCustomerOtpRecord = async ({ identifier, dairyId, key, redisKey }) => {
  const redis = getRedisConnection();
  if (redis) {
    try {
      await redis.del(redisKey || buildRedisOtpKey(identifier, dairyId));
      return;
    } catch (err) {
      logger.warn("redis_del_otp_failed_using_memory_fallback", { error: err.message });
    }
  }
  otpStore.delete(key || buildOtpKey(identifier, dairyId));
};

export const generateCustomerOtp = async ({
  identifier,
  dairyId,
  customer: existingCustomer = null,
  awaitDelivery = true,
}) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const customer = existingCustomer || await findCustomerByIdentifier(normalizedIdentifier);

  if (!customer) throw new Error("Customer not found");
  if (!customer.email) throw new Error("Customer email not available for OTP delivery");

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

  purgeExpiredCustomerOtps();
  await setCustomerOtpRecord({
    identifier: normalizedIdentifier,
    dairyId,
    otp,
    expiresAt,
  });

  if (String(process.env.NODE_ENV || "development").toLowerCase() !== "production") {
    console.log(`[DEV OTP] Customer OTP for ${customer?.email || normalizedIdentifier}: ${otp}`);
  }

  if (awaitDelivery) {
    await sendCustomerOtpEmail({ customer, otp });
  } else {
    setImmediate(() => {
      sendCustomerOtpEmail({ customer, otp }).catch((error) => {
        console.error("[CUSTOMER OTP EMAIL ERROR]", {
          customerId: customer.id,
          email: customer.email,
          message: error?.message || String(error),
        });
      });
    });
  }

  return otp;
};

export const verifyCustomerOtp = async ({ identifier, otp, dairyId }) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const normalizedOtp = String(otp ?? "").trim();

  purgeExpiredCustomerOtps();
  const otpRecord = await getCustomerOtpRecord({
    identifier: normalizedIdentifier,
    dairyId,
  });

  if (!otpRecord || otpRecord.expiresAt <= Date.now()) {
    if (otpRecord) {
      await deleteCustomerOtpRecord({
        identifier: normalizedIdentifier,
        dairyId,
        key: otpRecord.key,
        redisKey: otpRecord.redisKey,
      });
    }
    throw new Error("OTP expired or not found");
  }

  if (otpRecord.otp !== normalizedOtp) throw new Error("Invalid OTP");

  await deleteCustomerOtpRecord({
    identifier: normalizedIdentifier,
    dairyId,
    key: otpRecord.key,
    redisKey: otpRecord.redisKey,
  });
  return otpRecord;
};

/**
 * Find Customer & Generate Token (Post-OTP)
 */
export const customerOtpLoginService = async ({ identifier, dairyId }) => {
  const normalizedIdentifier = normalizeIdentifier(identifier);
  const customer = await findCustomerByIdentifier(normalizedIdentifier);

  if (!customer) throw new Error("Customer not found");

  const tokens = await issueLoginTokens({
    id: customer.id,
    email: customer.email,
    role: "CUSTOMER",
    dairyId,
    actorType: "CUSTOMER",
  });

  return {
    token: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    user: customer,
  };
};

/**
 * Determine Redirect (Active Subscription Check)
 */
export const determineRedirectPath = async (userId, requestedDairyId) => {
  const subscriptionsPromise = supabase
    .from("subscriptions")
    .select("dairy_id, status")
    .eq("customer_id", userId);

  const deliveryHistoryPromise = hasHistoryRow({
    table: "deliveries",
    customerId: userId,
    customerColumns: ["customer_id"],
  });

  const paymentHistoryPromise = hasHistoryRow({
    table: "payments",
    customerId: userId,
    customerColumns: ["customer_id"],
  });

  const [
    { data: subscriptions, error },
    hasDeliveryHistory,
    hasPaymentHistory,
  ] = await Promise.all([
    subscriptionsPromise,
    deliveryHistoryPromise,
    paymentHistoryPromise,
  ]);

  if (error) {
    throw new Error("Failed to check customer subscription status");
  }

  const activeSubscriptions = (subscriptions || []).filter(
    (subscription) =>
      String(subscription?.status || "ACTIVE").toUpperCase() !== "CLOSED"
  );

  const hasActiveSubscription = activeSubscriptions.length > 0;
  const hasOneTimeHistory = hasDeliveryHistory || hasPaymentHistory;
  const shouldRedirectToDashboard = hasActiveSubscription || hasOneTimeHistory;

  const isRegisteredToRequestedDairy = !!(
    requestedDairyId &&
    activeSubscriptions.some(
      (subscription) => String(subscription?.dairy_id) === String(requestedDairyId)
    )
  );

  return {
    redirect: shouldRedirectToDashboard ? "/customer/dashboard" : "/explore",
    isRegisteredToRequestedDairy,
  };
};
