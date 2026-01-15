import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { supabase } from "./config.js";
import customerRoutes from "./routes/customer.routes.js";

// Load environment variables
dotenv.config();

// Create express app
const app = express();

// ======================
// Middlewares
// ======================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// Health Check Route
// ======================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 Dairy Automation Backend is running",
  });
});

// ======================
// API Routes
// ======================
app.use("/api/customer", customerRoutes);

// ======================
// Global Error Handler
// ======================
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
});

// ======================
// Start Server
// ======================
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});



app.get("/supabase-health", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .limit(1);

    console.log("Supabase data:", data);
    console.log("Supabase error:", error);

    res.json({ data, error });
  } catch (err) {
    console.error("Supabase exception:", err);
    res.status(500).json({ error: err.message });
  }
});

// setInterval(() => {
//   console.log("🟢 Server still alive");
// }, 5000);
