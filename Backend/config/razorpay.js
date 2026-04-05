import "./loadEnv.js";

const firstNonEmptyEnv = (...keys) => {
  for (const key of keys) {
    const value = String(process.env[key] || "").trim();
    if (value) return value;
  }
  return "";
};

export const getRazorpayConfig = () => {
  const keyId = firstNonEmptyEnv(
    "RAZORPAY_KEY_ID",
    "RAZORPAY_ID",
    "RAZORPAY_API_KEY"
  );
  const keySecret = firstNonEmptyEnv(
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_SECRET",
    "RAZORPAY_SECRET_KEY",
    "RAZORPAY_API_SECRET"
  );

  if (!keyId || !keySecret) {
    const error = new Error(
      "Razorpay is not configured on server. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Backend/.env."
    );
    error.statusCode = 500;
    throw error;
  }

  return { keyId, keySecret };
};
