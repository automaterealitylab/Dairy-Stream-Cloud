import { supabase } from "../../config/supabase.js";
import { getRedisConnection } from "../../config/redis.js";
import { issueLoginTokens } from "../../utils/jwt.js";
import bcrypt from "bcryptjs";
import cloudinary from "../../config/cloudinary.js";
import { ensureIdentityIsUnique } from "./identityUniqueness.service.js"; // Reuse existing uniqueness service
import verifyEmail from "../../utils/verifyEmail.js";
import { sendEmail } from "../../utils/email.js";

// const normalizeIdentifier = (value) => String(value ?? "").trim();
// const otpStore = new Map();

// const buildOtpKey = (identifier, dairyId) =>
//   `${normalizeIdentifier(identifier)}::${dairyId == null ? "null" : String(dairyId)}`;

// const purgeExpiredOtps = () => {
//   const now = Date.now();
//   for (const [key, value] of otpStore.entries()) {
//     if (!value?.expiresAt || value.expiresAt <= now) {
//       otpStore.delete(key);
//     }
//   }
// };

// const buildPhoneVariants = (identifier) => {
//   const raw = normalizeIdentifier(identifier);
//   const digitsOnly = raw.replace(/\D/g, "");
//   const variants = new Set([raw]);

//   if (digitsOnly) {
//     variants.add(digitsOnly);
//     if (digitsOnly.length > 10) variants.add(digitsOnly.slice(-10));
//   }

//   return [...variants].filter(Boolean);
// };

// const buildLoosePhonePattern = (identifier) => {
//   const digitsOnly = normalizeIdentifier(identifier).replace(/\D/g, "");
//   const last10 = digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
//   if (last10.length < 10) return null;
//   return `%${last10.slice(0, 5)}%${last10.slice(5)}%`;
// };

// import fs from "fs";
// import path from "path";
// import { fileURLToPath } from "url";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const sendOtp = async ({ identifier, otp }) => {
//   console.log(`[OTP] Identifier: ${identifier}, OTP: ${otp}`);
  
//   // Log to file for easy access
//   try {
//     const logPath = path.join(__dirname, "../../otp.log");
//     fs.appendFileSync(logPath, `[${new Date().toISOString()}] Identifier: ${identifier}, OTP: ${otp}\n`);
//   } catch (err) {
//     console.error("Failed to write to OTP log file:", err);
//   }
// };

// // ===============================
// // DETECT USER
// // ===============================
// // export const detectUserService = async (identifier) => {
// //   const normalizedIdentifier = normalizeIdentifier(identifier);

// //   if (normalizedIdentifier.includes("@")) {
// //     return { userType: "ADMIN", nextStep: "PASSWORD" };
// //   }

// //   if (normalizedIdentifier.toUpperCase().startsWith("STF")) {
// //     return { userType: "STAFF", nextStep: "PASSWORD" };
// //   }

// //   const phoneVariants = buildPhoneVariants(normalizedIdentifier);

// //   const { data } = await supabase
// //     .from("customers")
// //     .select("id")
// //     .in("phone_number", phoneVariants);

// //   if (!data || data.length === 0) {
// //     return { userType: "CUSTOMER", nextStep: "EXPLORE" };
// //   }

// //   if (data.length === 1) {
// //     return {
// //       userType: "CUSTOMER",
// //       nextStep: "OTP",
// //     };
// //   }

// //   return {
// //     userType: "CUSTOMER",
// //     dairies: data.map((c) => ({ id: c.id })),
// //     nextStep: "SELECT_DAIRY",
// //   };
// // };

// // ===============================
// // OTP
// // ===============================
// export const generateCustomerOtp = async ({ identifier, dairyId }) => {
//   const normalizedIdentifier = normalizeIdentifier(identifier);
//   const otp = Math.floor(100000 + Math.random() * 900000).toString();
//   const expiresAt = Date.now() + 5 * 60 * 1000;

//   purgeExpiredOtps();
//   const key = buildOtpKey(normalizedIdentifier, dairyId);
//   otpStore.set(key, {
//     identifier: normalizedIdentifier,
//     dairy_id: dairyId ?? null,
//     otp,
//     expiresAt,
//   });

//   await sendOtp({ identifier: normalizedIdentifier, otp });
// };

// export const verifyCustomerOtp = async ({ identifier, otp, dairyId }) => {
//   const normalizedIdentifier = normalizeIdentifier(identifier);
//   const normalizedOtp = String(otp ?? "").trim();

//   if (!normalizedOtp) {
//     throw new Error("OTP is required");
//   }

//   purgeExpiredOtps();

//   const candidates = [];
//   for (const [key, value] of otpStore.entries()) {
//     if (value.identifier !== normalizedIdentifier) continue;
//     if (dairyId !== undefined) {
//       const expectedDairy = dairyId ?? null;
//       if (value.dairy_id !== expectedDairy) continue;
//     }
//     candidates.push({ key, ...value });
//   }

//   candidates.sort((a, b) => b.expiresAt - a.expiresAt);
//   const latestOtp = candidates[0];

//   if (!latestOtp) throw new Error("Invalid or expired OTP");
//   if (latestOtp.otp !== normalizedOtp) throw new Error("Invalid OTP");

//   otpStore.delete(latestOtp.key);

//   return latestOtp;
// };

// // ===============================
// // LOGIN
// // ===============================
// export const customerOtpLoginService = async ({ identifier, dairyId }) => {
//   const normalizedIdentifier = normalizeIdentifier(identifier);
//   const isEmail = normalizedIdentifier.includes("@");
//   let customer = null;

//   if (isEmail) {
//     const { data: emailCustomer } = await supabase
//       .from("customers")
//       .select("*")
//       .ilike("email", normalizedIdentifier)
//       .limit(1)
//       .maybeSingle();
//     customer = emailCustomer;
//   } else {
//     const phoneVariants = buildPhoneVariants(normalizedIdentifier);
//     const exactQuery = supabase
//       .from("customers")
//       .select("*")
//       .in("phone_number", phoneVariants);

//     const { data: exactCustomer } = await exactQuery.limit(1).maybeSingle();
//     customer = exactCustomer;

//     if (!customer) {
//       const loosePattern = buildLoosePhonePattern(normalizedIdentifier);
//       if (loosePattern) {
//         const looseQuery = supabase
//           .from("customers")
//           .select("*")
//           .ilike("phone_number", loosePattern);

//         const { data: looseCustomer } = await looseQuery.limit(1).maybeSingle();
//         customer = looseCustomer;
//       }
//     }
//   }

//   if (!customer) throw new Error("Customer not found");

//   const token = generateToken({
//     id: customer.id,
//     email: customer.email ?? null,
//     role: "CUSTOMER",
//     dairyId,
//   });

//   return {
//     token,
//     role: "CUSTOMER",
//     user: customer,
//   };
// };



// ==========================================
// INTERNAL HELPERS (Moved from Controller)
// ==========================================
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
    query = query.ilike("email", normalizedIdentifier);
  } else {
    query = query.in("phone_number", phoneVariants);
  }

  const { data: customer, error } = await query.limit(1).maybeSingle();
  if (error) throw error;
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

  // 2. Insert into DB 
  // We remove 'password' and 'profile_photo_url' from the insert object
  const { data, error } = await supabase
    .from("customers")
    .insert([
      {
        customer_name: customerName,
        email: normalizedEmail,
        phone_number: phoneNumber,
        address_line_1: String(addressLine1 || "").trim() || null,
        address_line_2: String(addressLine2 || "").trim() || null,
        building_name: buildingName || null,
        wing: wing || null,
        room_no: roomNo,
        latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
        longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,
        // ✅ Password and Photo are omitted so they stay NULL in DB
        default_milk_quantity_liters: defaultMilkQuantityLiters || 1,
        billing_cycle: billingCycle || "Monthly",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Supabase Error:", error.message);
    if (isMissingCustomerRegistrationLocationColumns(error)) {
      throw new Error(
        "Customer location fields are not ready in the database. Run the updated SUPABASE_MIGRATIONS.sql and try again."
      );
    }
    throw new Error(error.message);
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
    query = query.ilike("email", normalizeEmail(normalizedIdentifier));
  } else {
    query = query.in("phone_number", buildPhoneVariants(normalizedIdentifier));
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) throw new Error("Database error");
  if (!data) throw new Error("Customer not found");
  if (!data.password) throw new Error("Password not set for this account");

  const isMatch = await bcrypt.compare(password, data.password);
  if (!isMatch) throw new Error("Invalid password");

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
  await sendEmail({
    to: customer.email,
    subject: "DairyStream Customer Login OTP",
    html: `
      <p>Your OTP for customer login is:</p>
      <h2>${otp}</h2>
      <p>This OTP is valid for 5 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });

  console.log(`[OTP SENT] To email: ${customer.email} | OTP: ${otp}`);
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
    await redis.set(
      buildRedisOtpKey(identifier, dairyId),
      JSON.stringify(record),
      "EX",
      CUSTOMER_OTP_TTL_SECONDS
    );
    return;
  }

  otpStore.set(buildOtpKey(identifier, dairyId), record);
};

const getCustomerOtpRecord = async ({ identifier, dairyId }) => {
  const redis = getRedisConnection();
  const key = buildOtpKey(identifier, dairyId);

  if (redis) {
    const value = await redis.get(buildRedisOtpKey(identifier, dairyId));
    if (!value) return null;
    return { key, redisKey: buildRedisOtpKey(identifier, dairyId), ...JSON.parse(value) };
  }

  const value = otpStore.get(key);
  return value ? { key, ...value } : null;
};

const deleteCustomerOtpRecord = async ({ identifier, dairyId, key, redisKey }) => {
  const redis = getRedisConnection();
  if (redis) {
    await redis.del(redisKey || buildRedisOtpKey(identifier, dairyId));
    return;
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
