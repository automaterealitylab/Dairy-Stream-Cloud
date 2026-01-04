const express = require("express");
const cors = require("cors");
// require("dotenv").config();

// create express app
const app = express();

// ======================
// Middlewares
// ======================
app.use(cors()); // allow frontend requests
app.use(express.json()); // parse JSON body
app.use(express.urlencoded({ extended: true })); // parse form data

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
// API Routes (later)
// ======================
// app.use("/api/customers", customerRoutes);
// app.use("/api/agents", agentRoutes);
// app.use("/api/admin", adminRoutes);

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
  console.log(`✅ Server running on port http://localhost:${PORT}`);
});
