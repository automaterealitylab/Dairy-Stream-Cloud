import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Razorpay from "razorpay";

// 1. Load Environment Variables
dotenv.config();

// 2. Import Configuration & Routes
// ✅ Points to your root config.js
import { supabase } from "./config/supabase.js"; 
// ✅ Points to your central Route Hub
import routes from "./routes/index.route.js"; 
import { runDailySubscriptionAutomationForAllCustomers } from "./services/customer/subscription.automation.service.js";

// 3. Create App
const app = express();

// ======================
// 🛡️ Middlewares
// ======================
app.use(cors()); // Allow Frontend access
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

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
    // We query the 'users' table (or any active table) just to test connection
    const { data, error } = await supabase.from("users").select("id").limit(1);
    
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

// Handle "Port in use" errors gracefully (from your old app.js)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.error(`👉 Stop the other terminal or change PORT in .env`);
    process.exit(1);
  }
});
