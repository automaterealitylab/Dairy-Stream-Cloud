import axios from "axios";
import crypto from "crypto";
import Razorpay from "razorpay";
import { getRazorpayConfig } from "../../config/razorpay.js";
import { logError, logger } from "../../utils/logger.js";
import { metrics } from "../../utils/metrics.js";

const RAZORPAY_API_BASE_URL = "https://api.razorpay.com";
const circuit = {
  failures: 0,
  openedUntil: 0,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRazorpayResilience = async (operation, fn, { timeout = 20_000 } = {}) => {
  const now = Date.now();
  if (circuit.openedUntil > now) {
    const error = new Error("Razorpay circuit breaker is open");
    error.statusCode = 503;
    throw error;
  }

  const maxAttempts = Number(process.env.RAZORPAY_API_ATTEMPTS || 3);
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const started = Date.now();
    try {
      const result = await fn({ timeout });
      circuit.failures = 0;
      metrics.observe("razorpay_api_latency_ms", { operation }, Date.now() - started);
      metrics.increment("razorpay_api_success", { operation });
      return result;
    } catch (err) {
      lastError = err;
      metrics.increment("razorpay_api_failure", { operation });
      const status = err?.response?.status || err?.statusCode;
      const retryable = !status || status >= 500 || status === 408 || status === 429;
      if (!retryable || attempt === maxAttempts) break;
      const delay = Math.min(
        Number(process.env.RAZORPAY_API_MAX_BACKOFF_MS || 15000),
        Number(process.env.RAZORPAY_API_BASE_BACKOFF_MS || 750) * 2 ** (attempt - 1)
      );
      await sleep(delay);
    }
  }

  circuit.failures += 1;
  if (circuit.failures >= Number(process.env.RAZORPAY_CIRCUIT_FAILURE_THRESHOLD || 5)) {
    circuit.openedUntil = Date.now() + Number(process.env.RAZORPAY_CIRCUIT_OPEN_MS || 60_000);
    logger.warn("razorpay_circuit_opened", { operation, failures: circuit.failures });
  }
  logError("razorpay_api_failed", lastError, { operation });
  throw lastError;
};

const getAuth = () => {
  const { keyId, keySecret } = getRazorpayConfig();
  return {
    username: keyId,
    password: keySecret,
  };
};

export const getRouteKeyId = () => getRazorpayConfig().keyId;

export const getRouteRazorpayClient = () => {
  const { keyId, keySecret } = getRazorpayConfig();
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

export const createLinkedAccount = async ({
  dairyId,
  dairyName,
  ownerName,
  email,
  phone,
  pan,
  address,
  city = "",
  state = "",
  pincode = "",
}) => {
  const payload = {
    email,
    phone,
    type: "route",
    reference_id: `dairy_${dairyId}`.slice(0, 40),
    legal_business_name: dairyName,
    customer_facing_business_name: dairyName,
    business_type: "individual",
    contact_name: ownerName,
    profile: {
      category: "food",
      subcategory: "dairy_products",
      addresses: {
        registered: {
          street1: String(address || "").slice(0, 100) || "Registered address",
          street2: "",
          city: String(city || "NA").slice(0, 50),
          state: String(state || "NA").slice(0, 50),
          postal_code: String(pincode || "000000").slice(0, 10),
          country: "IN",
        },
      },
    },
    legal_info: {
      pan,
    },
    notes: {
      dairy_id: String(dairyId),
      platform: "Dairy Stream Cloud",
    },
  };

  const { data } = await withRazorpayResilience("create_linked_account", ({ timeout }) =>
    axios.post(`${RAZORPAY_API_BASE_URL}/v2/accounts`, payload, {
      auth: getAuth(),
      timeout,
    })
  );

  return data;
};

export const createStakeholder = async ({
  accountId,
  ownerName,
  email,
  phone,
  pan,
  address,
  city = "",
  state = "",
  pincode = "",
}) => {
  const payload = {
    name: ownerName,
    email,
    phone: {
      primary: phone,
    },
    kyc: {
      pan,
    },
    addresses: {
      residential: {
        street: String(address || "").slice(0, 100) || "Residential address",
        city: String(city || "NA").slice(0, 50),
        state: String(state || "NA").slice(0, 50),
        postal_code: String(pincode || "000000").slice(0, 10),
        country: "IN",
      },
    },
    notes: {
      platform: "Dairy Stream Cloud",
    },
  };

  const { data } = await withRazorpayResilience("create_stakeholder", ({ timeout }) =>
    axios.post(
      `${RAZORPAY_API_BASE_URL}/v2/accounts/${accountId}/stakeholders`,
      payload,
      {
        auth: getAuth(),
        timeout,
      }
    )
  );

  return data;
};

export const requestRouteProduct = async (accountId) => {
  const { data } = await withRazorpayResilience("request_route_product", ({ timeout }) =>
    axios.post(
      `${RAZORPAY_API_BASE_URL}/v2/accounts/${accountId}/products`,
      {
        product_name: "route",
        tnc_accepted: true,
      },
      {
        auth: getAuth(),
        timeout,
      }
    )
  );

  return data;
};

export const fetchRazorpayPayment = async (paymentId) => {
  const { data } = await withRazorpayResilience("fetch_payment", ({ timeout }) =>
    axios.get(`${RAZORPAY_API_BASE_URL}/v1/payments/${paymentId}`, {
      auth: getAuth(),
      timeout,
    })
  );

  return data;
};

export const fetchLinkedAccount = async (accountId) => {
  const { data } = await withRazorpayResilience("fetch_linked_account", ({ timeout }) =>
    axios.get(`${RAZORPAY_API_BASE_URL}/v2/accounts/${accountId}`, {
      auth: getAuth(),
      timeout,
    })
  );

  return data;
};

export const fetchRouteProduct = async ({ accountId, productId }) => {
  const { data } = await withRazorpayResilience("fetch_route_product", ({ timeout }) =>
    axios.get(
      `${RAZORPAY_API_BASE_URL}/v2/accounts/${accountId}/products/${productId}`,
      {
        auth: getAuth(),
        timeout,
      }
    )
  );

  return data;
};

export const fetchOrderTransfers = async (orderId) => {
  const { data } = await withRazorpayResilience("fetch_order_transfers", ({ timeout }) =>
    axios.get(
      `${RAZORPAY_API_BASE_URL}/v1/orders/${orderId}/transfers`,
      {
        auth: getAuth(),
        timeout,
      }
    )
  );

  return Array.isArray(data?.items) ? data.items : [];
};

export const updateRouteSettlementConfig = async ({
  accountId,
  productId,
  accountNumber,
  ifsc,
  beneficiaryName,
}) => {
  const { data } = await withRazorpayResilience("update_route_settlement_config", ({ timeout }) =>
    axios.patch(
      `${RAZORPAY_API_BASE_URL}/v2/accounts/${accountId}/products/${productId}`,
      {
        settlements: {
          account_number: accountNumber,
          ifsc_code: ifsc,
          beneficiary_name: beneficiaryName,
        },
        tnc_accepted: true,
      },
      {
        auth: getAuth(),
        timeout,
      }
    )
  );

  return data;
};

export const verifyCheckoutSignature = ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) => {
  const { keySecret } = getRazorpayConfig();
  const generated = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return generated === razorpaySignature;
};

export const verifyWebhookSignature = ({ rawBody, signature }) => {
  const webhookSecret = String(process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
  if (!webhookSecret) {
    const error = new Error("RAZORPAY_WEBHOOK_SECRET is not configured");
    error.statusCode = 500;
    throw error;
  }

  const bodyBuffer = Buffer.isBuffer(rawBody)
    ? rawBody
    : Buffer.from(String(rawBody || ""), "utf8");
  const generated = crypto
    .createHmac("sha256", webhookSecret)
    .update(bodyBuffer)
    .digest("hex");

  return generated === signature;
};
