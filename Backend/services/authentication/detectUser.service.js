import { supabase } from "../../config/supabase.js";
import { generateCustomerOtp } from "./customerAuth.service.js";
import { encryptDeterministic, decryptDeterministic } from "../../utils/crypto.js";

const normalizeIdentifier = (value) => String(value ?? "").trim();
const slowDetectThresholdMs = Number(process.env.AUTH_DETECT_SLOW_LOG_MS || 500);
const identityCacheTtlMs = Number(process.env.AUTH_DETECT_CACHE_TTL_MS || 5 * 60 * 1000);
const missingIdentityCacheTtlMs = Number(process.env.AUTH_DETECT_MISSING_CACHE_TTL_MS || 15 * 1000);
const identityCacheMaxEntries = Number(process.env.AUTH_DETECT_CACHE_MAX_ENTRIES || 1000);
const identityCache = new Map();

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const logSlowLookup = (lookup, startedAt, meta = {}) => {
  const durationMs = Math.round(nowMs() - startedAt);
  if (durationMs >= slowDetectThresholdMs) {
    console.warn("[AUTH DETECT] slow lookup:", {
      lookup,
      durationMs,
      ...meta,
    });
  }
};
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

const getCachedIdentity = (key) => {
  const entry = identityCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    identityCache.delete(key);
    return undefined;
  }

  identityCache.delete(key);
  identityCache.set(key, entry);
  return entry.value;
};

const setCachedIdentity = (key, value, ttlMs = identityCacheTtlMs) => {
  if (!key || ttlMs <= 0) return;

  if (identityCache.size >= identityCacheMaxEntries) {
    const oldestKey = identityCache.keys().next().value;
    if (oldestKey) identityCache.delete(oldestKey);
  }

  identityCache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
};

const cacheKeyFor = (kind, identifier) => `${kind}:${normalizeIdentifier(identifier).toLowerCase()}`;

const findAdminByIdentifier = async (rawIdentifier) => {
  const startedAt = nowMs();
  const identifier = normalizeIdentifier(rawIdentifier);
  const isEmail = identifier.includes("@");

  if (isEmail) {
    const cacheKey = cacheKeyFor("admin:email", identifier);
    const cached = getCachedIdentity(cacheKey);
    if (cached !== undefined) return cached;

    const { data, error } = await supabase
      .from("admins")
      .select("id, email, name")
      .or(`email.eq.${encryptDeterministic(identifier.toLowerCase())},email.eq.${identifier.toLowerCase()}`)
      .limit(1)
      .maybeSingle();

    logSlowLookup("admins.email", startedAt);
    if (error) {
      logLookupError("admins.email", error, { identifierType: "email" });
      throw error;
    }
    if (data) {
      data.email = decryptDeterministic(data.email);
    }
    const result = data || null;
    setCachedIdentity(cacheKey, result, result ? identityCacheTtlMs : missingIdentityCacheTtlMs);
    return result;
  }

  const mobile = identifier.replace(/\D/g, "");
  if (mobile.length < 10) return null;

  for (const column of ["phone", "phone_number"]) {
    const cacheKey = cacheKeyFor(`admin:${column}`, mobile);
    const cached = getCachedIdentity(cacheKey);
    if (cached !== undefined) return cached;

    const { data, error } = await supabase
      .from("admins")
      .select(`id, email, name, ${column}`)
      .or(`${column}.eq.${encryptDeterministic(mobile)},${column}.eq.${mobile}`)
      .limit(1)
      .maybeSingle();

    logSlowLookup("admins.mobile", startedAt, { column });
    if (!error && data) {
      data.email = decryptDeterministic(data.email);
      data[column] = decryptDeterministic(data[column]);
      setCachedIdentity(cacheKey, data);
      return data;
    }
    if (error && !isMissingColumnError(error)) {
      logLookupError("admins.mobile", error, { column });
      throw error;
    }

    if (!error) {
      setCachedIdentity(cacheKey, null, missingIdentityCacheTtlMs);
    }
  }

  return null;
};

const findCustomerByIdentifier = async (rawIdentifier) => {
  const startedAt = nowMs();
  const identifier = normalizeIdentifier(rawIdentifier);
  const isEmail = identifier.includes("@");

  if (isEmail) {
    const cacheKey = cacheKeyFor("customer:email", identifier);
    const cached = getCachedIdentity(cacheKey);
    if (cached !== undefined) return cached;

    const { data, error } = await supabase
      .from("customers")
      .select("id, customer_name, email")
      .or(`email.eq.${encryptDeterministic(identifier.toLowerCase())},email.eq.${identifier.toLowerCase()}`)
      .limit(1)
      .maybeSingle();

    logSlowLookup("customers.email", startedAt);
    if (error) {
      logLookupError("customers.email", error, { identifierType: "email" });
      throw error;
    }
    if (data) {
      data.email = decryptDeterministic(data.email);
    }
    const result = data || null;
    setCachedIdentity(cacheKey, result, result ? identityCacheTtlMs : missingIdentityCacheTtlMs);
    return result;
  }

  const mobile = identifier.replace(/\D/g, "");
  if (mobile.length < 10) return null;
  const cacheKey = cacheKeyFor("customer:phone_number", mobile);
  const cached = getCachedIdentity(cacheKey);
  if (cached !== undefined) return cached;

  const { data, error } = await supabase
    .from("customers")
    .select("id, customer_name, email, phone_number")
    .or(`phone_number.eq.${encryptDeterministic(mobile)},phone_number.eq.${mobile}`)
    .limit(1)
    .maybeSingle();

  logSlowLookup("customers.phone_number", startedAt);
  if (error) {
    logLookupError("customers.phone_number", error);
    throw error;
  }
  if (data) {
    data.email = decryptDeterministic(data.email);
    data.phone_number = decryptDeterministic(data.phone_number);
  }
  const result = data || null;
  setCachedIdentity(cacheKey, result, result ? identityCacheTtlMs : missingIdentityCacheTtlMs);
  return result;
};

const findAgentByStaffId = async (rawIdentifier) => {
  const startedAt = nowMs();
  const normalizedAgentId = normalizeIdentifier(rawIdentifier).toUpperCase();
  if (!normalizedAgentId.startsWith("STF")) return null;
  const cacheKey = cacheKeyFor("agent:agent_id", normalizedAgentId);
  const cached = getCachedIdentity(cacheKey);
  if (cached !== undefined) return cached;

  const { data, error } = await supabase
    .from("agents")
    .select("agent_id, agent_name")
    .eq("agent_id", normalizedAgentId)
    .limit(1)
    .maybeSingle();

  logSlowLookup("agents.agent_id", startedAt);
  if (error) {
    logLookupError("agents.agent_id", error);
    throw error;
  }
  const result = data || null;
  setCachedIdentity(cacheKey, result, result ? identityCacheTtlMs : missingIdentityCacheTtlMs);
  return result;
};

export const detectUserService = async (identifier, options = {}) => {
  const startedAt = nowMs();
  const rawId = normalizeIdentifier(identifier);
  const { requestCustomerOtp = false, dairyId = null } = options;
  const mobile = rawId.replace(/\D/g, "");
  const isStaffId = rawId.toUpperCase().startsWith("STF");
  const isEmail = rawId.includes("@");

  if (isStaffId) {
    const agent = await findAgentByStaffId(rawId);
    logSlowLookup("detect.total", startedAt, { type: "staff" });
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

  const customer = !isEmail && mobile.length >= 10
    ? await findCustomerByIdentifier(rawId)
    : null;

  if (customer) {
    return await buildCustomerDetectResponse({
      rawId,
      dairyId,
      customer,
      requestCustomerOtp,
      startedAt,
    });
  }

  const admin = await findAdminByIdentifier(rawId);

  if (admin) {
    logSlowLookup("detect.total", startedAt, { type: "admin" });
    return {
      exists: true,
      userType: "ADMIN",
      nextStep: "PASSWORD",
      name: admin.name || "Admin",
    };
  }

  if (isEmail) {
    const emailCustomer = await findCustomerByIdentifier(rawId);
    if (emailCustomer) {
      return await buildCustomerDetectResponse({
        rawId,
        dairyId,
        customer: emailCustomer,
        requestCustomerOtp,
        startedAt,
      });
    }
  }

  logSlowLookup("detect.total", startedAt, { type: "missing" });
  if (mobile.length >= 10) {
    return { exists: false, userType: "NEW_USER", nextStep: "REGISTER" };
  }

  return { exists: false, error: "User not found", nextStep: "IDENTIFIER" };
};

const buildCustomerDetectResponse = async ({
  rawId,
  dairyId,
  customer,
  requestCustomerOtp,
  startedAt,
}) => {
  const hasOtpDelivery = Boolean(String(customer.email || "").trim());
  let otpRequested = false;
  let otpDeliveryError = null;

  if (requestCustomerOtp && hasOtpDelivery) {
    try {
      await generateCustomerOtp({
        identifier: normalizeCustomerLoginIdentifier(rawId),
        dairyId,
        customer,
        awaitDelivery: false,
      });
      otpRequested = true;
    } catch (error) {
      otpDeliveryError = error?.message || "Failed to send OTP";
      console.error("[AUTH DETECT] customer OTP delivery failed:", {
        customerId: customer.id,
        dairyId,
        message: otpDeliveryError,
      });
    }
  }

  logSlowLookup("detect.total", startedAt, { type: "customer" });
  return {
    exists: true,
    userType: "CUSTOMER",
    nextStep: "OTP",
    name: customer.customer_name || "Customer",
    hasOtpDelivery,
    otpRequested,
    otpDeliveryError,
    emailMasked: hasOtpDelivery
      ? customer.email.replace(/(^.).*(@.*$)/, "$1***$2")
      : null,
  };
};

