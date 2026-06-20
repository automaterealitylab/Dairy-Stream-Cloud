/**
 * Seed initial app settings to the database
 * Run: node Backend/scripts/seed-app-settings.js
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: "Backend/.env" });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const INITIAL_SETTINGS = [
  // OTP Authentication Settings
  {
    setting_key: "AGENT_OTP_EXPIRY_MS",
    setting_value: "600000", // 10 minutes
    setting_type: "number",
    description: "Agent OTP expiry time in milliseconds",
  },
  {
    setting_key: "AGENT_OTP_REQUEST_LIMIT",
    setting_value: "3",
    setting_type: "number",
    description: "Maximum OTP requests allowed per window",
  },
  {
    setting_key: "AGENT_OTP_REQUEST_WINDOW_MS",
    setting_value: "900000", // 15 minutes
    setting_type: "number",
    description: "Time window for OTP request rate limiting in milliseconds",
  },
  {
    setting_key: "ADMIN_OTP_EXPIRY_MS",
    setting_value: "600000", // 10 minutes
    setting_type: "number",
    description: "Admin OTP expiry time in milliseconds",
  },
  {
    setting_key: "ADMIN_OTP_REQUEST_LIMIT",
    setting_value: "3",
    setting_type: "number",
    description: "Maximum OTP requests for admin per window",
  },
  {
    setting_key: "ADMIN_OTP_REQUEST_WINDOW_MS",
    setting_value: "900000", // 15 minutes
    setting_type: "number",
    description: "Time window for admin OTP request rate limiting",
  },
  {
    setting_key: "CUSTOMER_OTP_EXPIRY_MS",
    setting_value: "300000", // 5 minutes
    setting_type: "number",
    description: "Customer OTP expiry time in milliseconds",
  },

  // Marketplace Settings
  {
    setting_key: "MARKETPLACE_TAX_PERCENT",
    setting_value: "0",
    setting_type: "number",
    description: "Marketplace tax percentage",
  },
  {
    setting_key: "MARKETPLACE_DELIVERY_FEE",
    setting_value: "0",
    setting_type: "number",
    description: "Marketplace delivery fee in rupees",
  },
  {
    setting_key: "MARKETPLACE_RATE_LIMIT_PER_MINUTE",
    setting_value: "60",
    setting_type: "number",
    description: "Rate limit for marketplace API per minute",
  },
  {
    setting_key: "WEBHOOK_RATE_LIMIT_PER_MINUTE",
    setting_value: "300",
    setting_type: "number",
    description: "Rate limit for webhook processing per minute",
  },

  // Delivery Service Settings
  {
    setting_key: "ONLINE_COLLECTION_TTL_MS",
    setting_value: "1200000", // 20 minutes
    setting_type: "number",
    description: "TTL for online collection cache in milliseconds",
  },
  {
    setting_key: "NEARBY_PAGE_SIZE",
    setting_value: "20",
    setting_type: "number",
    description: "Number of items per page for nearby dairies",
  },

  // Email Settings
  {
    setting_key: "EMAIL_HTTP_TIMEOUT_MS",
    setting_value: "8000",
    setting_type: "number",
    description: "Email HTTP timeout in milliseconds",
  },
  {
    setting_key: "EMAIL_CONNECTION_TIMEOUT_MS",
    setting_value: "5000",
    setting_type: "number",
    description: "Email connection timeout",
  },
  {
    setting_key: "EMAIL_GREETING_TIMEOUT_MS",
    setting_value: "5000",
    setting_type: "number",
    description: "Email greeting timeout",
  },
  {
    setting_key: "EMAIL_SOCKET_TIMEOUT_MS",
    setting_value: "8000",
    setting_type: "number",
    description: "Email socket timeout",
  },
  {
    setting_key: "EMAIL_SMTP_RETRY_BACKOFF_MS",
    setting_value: "2000",
    setting_type: "number",
    description: "Email SMTP retry backoff time",
  },

  // WhatsApp Settings
  {
    setting_key: "WHATSAPP_MAX_ATTEMPTS",
    setting_value: "3",
    setting_type: "number",
    description: "Maximum WhatsApp retry attempts",
  },
  {
    setting_key: "WHATSAPP_RETRY_DELAY_MS",
    setting_value: "300000", // 5 minutes
    setting_type: "number",
    description: "WhatsApp retry delay in milliseconds",
  },

  // Bank Verification Settings
  {
    setting_key: "IFSC_LOOKUP_TIMEOUT_MS",
    setting_value: "6000",
    setting_type: "number",
    description: "IFSC lookup timeout in milliseconds",
  },
  {
    setting_key: "BANK_VERIFICATION_TIMEOUT_MS",
    setting_value: "10000",
    setting_type: "number",
    description: "Bank account verification timeout",
  },

  // Razorpay Settings
  {
    setting_key: "RAZORPAY_API_ATTEMPTS",
    setting_value: "3",
    setting_type: "number",
    description: "Number of Razorpay API retry attempts",
  },
  {
    setting_key: "RAZORPAY_API_TIMEOUT_MS",
    setting_value: "20000", // 20 seconds
    setting_type: "number",
    description: "Razorpay API timeout in milliseconds",
  },

  // Fraud Detection Settings
  {
    setting_key: "FRAUD_HIGH_VALUE_ORDER_INR",
    setting_value: "50000",
    setting_type: "number",
    description: "Threshold for high-value orders (INR)",
  },

  // Reconciliation Settings
  {
    setting_key: "MARKETPLACE_RECONCILIATION_LIMIT",
    setting_value: "100",
    setting_type: "number",
    description: "Batch size for marketplace reconciliation",
  },
  {
    setting_key: "RECONCILIATION_PENDING_WEBHOOK_RETRIES_LIMIT",
    setting_value: "50",
    setting_type: "number",
    description: "Batch size for webhook retry processing",
  },

  // Distributed Lock Settings
  {
    setting_key: "DISTRIBUTED_LOCK_TTL_MS",
    setting_value: "120000", // 2 minutes
    setting_type: "number",
    description: "Distributed lock TTL in milliseconds",
  },

  // Queue Settings
  {
    setting_key: "QUEUE_JOB_ATTEMPTS",
    setting_value: "7",
    setting_type: "number",
    description: "Number of job retry attempts",
  },
  {
    setting_key: "QUEUE_JOB_BACKOFF_MS",
    setting_value: "5000",
    setting_type: "number",
    description: "Job backoff time between retries",
  },
];

async function seedSettings() {
  try {
    console.log("Starting to seed app settings...");

    const { error } = await supabase.from("app_settings").upsert(INITIAL_SETTINGS, {
      onConflict: "setting_key",
    });

    if (error) {
      console.error("Error seeding settings:", error);
      process.exit(1);
    }

    console.log(`✓ Successfully seeded ${INITIAL_SETTINGS.length} app settings`);
    process.exit(0);
  } catch (error) {
    console.error("Failed to seed settings:", error);
    process.exit(1);
  }
}

seedSettings();
