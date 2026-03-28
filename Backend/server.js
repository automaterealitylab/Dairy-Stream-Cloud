import express from "express";
import cors from "cors";
import Razorpay from "razorpay";
import cron from "node-cron";
import "./config/loadEnv.js";

// 2. Import Configuration & Routes
// ✅ Points to your root config.js
import { supabase } from "./config/supabase.js"; 
// ✅ Points to your central Route Hub
import routes from "./routes/index.route.js"; 
import {
  autoFailPendingSubscriptionDeliveriesForDate,
  runDailySubscriptionAutomationForAllCustomers,
} from "./services/customer/subscription.automation.service.js";
import { runMonthEndSubscriptionBillingForAllCustomers } from "./services/customer/monthlyBilling.service.js";

// 3. Create App
const app = express();

// ======================
// 🛡️ Middlewares
// ======================
app.use(cors()); // Allow Frontend access
app.use(express.json({ limit: "10mb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ======================
// 🏥 Health Check Routes
// ======================
// Simple server check
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 Dairy Automation Backend is running",
    timestamp: new Date()
  });
});

// Database connection check
app.get("/supabase-health", async (req, res) => {
  try {
    // Query a known table so the health check reflects real connectivity.
    const { data, error } = await supabase.from("customers").select("id").limit(1);
    
    if (error) throw error;
    
    res.json({ 
        status: "connected", 
        message: "✅ Supabase connection successful" 
    });
  } catch (err) {
    console.error("Supabase exception:", err.message);
    res.status(500).json({ 
        status: "error", 
        message: "❌ Database connection failed", 
        error: err.message 
    });
  }
});

// ======================
// 🚦 API Routes (The Hub)
// ======================
// This mounts all your routes at /api
// e.g., /api/admin/addagent, /api/auth/login
app.use('/api', routes);

// ======================
// ⚠️ Global Error Handler
// ======================
app.use((err, req, res, next) => {
  console.error("❌ Global Server Error:", err.stack);

  if (err?.type === "entity.too.large" || err?.status === 413) {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large",
      error: err.message,
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: err.message,
  });
});

// ======================
// 🚀 Start Server
// ======================
const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

const runSubscriptionAutomation = async () => {
  try {
    const result = await runDailySubscriptionAutomationForAllCustomers();
    console.log(
      `[AUTO_SUBSCRIPTION] date=${result.date} created=${result.createdCount} skipped=${result.skippedCount}`
    );
  } catch (err) {
    console.error("AUTO_SUBSCRIPTION ERROR:", err?.message || err);
  }
};

runSubscriptionAutomation();
setInterval(runSubscriptionAutomation, 60 * 60 * 1000);

const getLocalDateInput = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPreviousLocalDateInput = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  date.setDate(date.getDate() - 1);
  return getLocalDateInput(date);
};

const runSubscriptionAutoFail = async () => {
  try {
    const result = await autoFailPendingSubscriptionDeliveriesForDate({
      targetDate: getPreviousLocalDateInput(),
    });
    console.log(
      `[AUTO_FAIL_SUBSCRIPTION] date=${result.date} failed=${result.failedCount}`
    );
  } catch (err) {
    console.error("AUTO_FAIL_SUBSCRIPTION ERROR:", err?.message || err);
  }
};

const runMonthEndSubscriptionBilling = async () => {
  try {
    const result = await runMonthEndSubscriptionBillingForAllCustomers();
    console.log(
      `[MONTH_END_BILLING] date=${result.date} customers=${result.customers} bills=${result.bills}`
    );
  } catch (err) {
    console.error("MONTH_END_BILLING ERROR:", err?.message || err);
  }
};

cron.schedule("0 0 * * *", runSubscriptionAutoFail, {
  timezone: "Asia/Kolkata",
});

cron.schedule("59 23 * * *", runMonthEndSubscriptionBilling, {
  timezone: "Asia/Kolkata",
});

// Handle "Port in use" errors gracefully (from your old app.js)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`👉 Stop the other terminal or change PORT in .env`);
    process.exit(1);
  }
});
