import express from "express";
import { createServer } from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import cron from "node-cron";
import "./config/loadEnv.js";
import { validateRuntimeEnv } from "./config/envValidation.js";

// 2. Import Configuration & Routes
// ✅ Points to your root config.js
import { supabase } from "./config/supabase.js"; 
// ✅ Points to your central Route Hub
import routes from "./routes/index.route.js"; 
import {
  apiRateLimit,
  botProtection,
  csrfProtection,
  isAllowedCorsOrigin,
  requestFingerprinting,
  secureHeaders,
  ssrfGuard,
  validateApiSignature,
} from "./middleware/security.middleware.js";
import {
  correlationMiddleware,
  globalErrorHandler,
  notFoundHandler,
} from "./middleware/observability.middleware.js";
import {
  autoFailPendingSubscriptionDeliveriesForDate,
  runDailySubscriptionAutomationForAllCustomers,
} from "./services/customer/subscription.automation.service.js";
import { runMonthEndSubscriptionBillingForAllCustomers } from "./services/customer/monthlyBilling.service.js";
import { registerLocationSocketHandlers } from "./socket/locationHandler.js";
import { isQueueEnabled } from "./services/marketplace/queue.service.js";
import { logger } from "./utils/logger.js";
import { acquireRedisLock } from "./config/redis.js";
import { processQueuedWhatsAppNotifications } from "./services/shared/whatsapp.service.js";
import { decryptRecursive } from "./utils/crypto.js";
import { getAvailablePort } from "./utils/portResolver.js";

// 3. Create App
validateRuntimeEnv();
const app = express();

// Global Response Decryption Middleware to ensure no ENC_DET: values leak to frontend
app.use((req, res, next) => {
  const originalJson = res.json;
  const originalSend = res.send;

  res.json = function (body) {
    if (body !== null && body !== undefined) {
      body = decryptRecursive(body);
    }
    return originalJson.call(this, body);
  };

  res.send = function (body) {
    if (body !== null && body !== undefined) {
      if (typeof body === "object") {
        body = decryptRecursive(body);
      } else if (typeof body === "string") {
        try {
          const trimmed = body.trim();
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            const parsed = JSON.parse(body);
            const decrypted = decryptRecursive(parsed);
            body = JSON.stringify(decrypted);
          }
        } catch (e) {
          // Ignore parse errors and send as-is
        }
      }
    }
    return originalSend.call(this, body);
  };

  next();
});

const httpServer = createServer(app);

// ======================
// 🛡️ Middlewares
// ======================
app.use(secureHeaders);
app.use(correlationMiddleware);
app.use(
  cors({
    origin(origin, callback) {
      return callback(null, isAllowedCorsOrigin(origin));
    },
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "10mb",
    verify: (req, res, buf) => {
      if (String(req.originalUrl || "").includes("/api/webhooks/raw")) {
        req.rawBody = Buffer.from(buf);
      }
    },
  })
); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestFingerprinting);
app.use(botProtection);
app.use(ssrfGuard);
app.use(validateApiSignature);
app.use(csrfProtection);

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

const shutdown = async () => {
  logger.info("server_shutdown_started");
  await Promise.all(localWorkers.map((worker) => worker.close()));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

app.get("/healthz", (req, res) => {
  res.json({
    status: "ok",
    uptimeSeconds: Number(process.uptime().toFixed(0)),
    queuesEnabled: isQueueEnabled(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/readyz", async (req, res) => {
  try {
    const { error } = await supabase.from("customers").select("id").limit(1);
    if (error) throw error;
    res.json({ status: "ready", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "not_ready", error: err.message });
  }
});

// ======================
// 🚦 API Routes (The Hub)
// ======================
// This mounts all your routes at /api
// e.g., /api/admin/addagent, /api/auth/login
app.use('/api', apiRateLimit, routes);
app.use(notFoundHandler);
app.use(globalErrorHandler);

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
const preferredPort = Number(process.env.PORT || 4000);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

registerLocationSocketHandlers(io);

const startServer = async () => {
  const port = await getAvailablePort(preferredPort);
  const server = httpServer.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server running on http://0.0.0.0:${port}`);
  });

  return server;
};

const server = await startServer();

const localWorkers =
  [];

const shouldRunInProcessJobs = () =>
  String(process.env.RUN_IN_PROCESS_JOBS || "true").toLowerCase() !== "false";

const runWithRedisLock = async ({ key, ttlMs, owner, task }) => {
  const lock = await acquireRedisLock({ key, ttlMs, owner });
  if (!lock.acquired) return null;
  try {
    return await task();
  } finally {
    await lock.release();
  }
};

const runSubscriptionAutomation = async () => {
  try {
    const result = await runWithRedisLock({
      key: `daily-subscription-automation:${getLocalDateInput()}`,
      ttlMs: 55 * 60 * 1000,
      owner: `api:${process.pid}`,
      task: runDailySubscriptionAutomationForAllCustomers,
    });
    if (!result) return;
    console.log(
      `[AUTO_SUBSCRIPTION] date=${result.date} created=${result.createdCount} skipped=${result.skippedCount}`
    );
  } catch (err) {
    console.error("AUTO_SUBSCRIPTION ERROR:", err?.message || err);
  }
};

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
    const targetDate = getPreviousLocalDateInput();
    const result = await runWithRedisLock({
      key: `subscription-auto-fail:${targetDate}`,
      ttlMs: 55 * 60 * 1000,
      owner: `api:${process.pid}`,
      task: () => autoFailPendingSubscriptionDeliveriesForDate({ targetDate }),
    });
    if (!result) return;
    console.log(
      `[AUTO_FAIL_SUBSCRIPTION] date=${result.date} failed=${result.failedCount}`
    );
  } catch (err) {
    console.error("AUTO_FAIL_SUBSCRIPTION ERROR:", err?.message || err);
  }
};

const runMonthEndSubscriptionBilling = async () => {
  try {
    const result = await runWithRedisLock({
      key: `month-end-subscription-billing:${new Date().toISOString().slice(0, 7)}`,
      ttlMs: 2 * 60 * 60 * 1000,
      owner: `api:${process.pid}`,
      task: runMonthEndSubscriptionBillingForAllCustomers,
    });
    if (!result) return;
    console.log(
      `[MONTH_END_BILLING] date=${result.date} customers=${result.customers} bills=${result.bills}`
    );
  } catch (err) {
    console.error("MONTH_END_BILLING ERROR:", err?.message || err);
  }
};

const runWhatsAppNotificationQueue = async () => {
  const lock = await acquireRedisLock({
    key: "whatsapp-notification-queue",
    ttlMs: 55_000,
    owner: `api:${process.pid}`,
  });
  if (!lock.acquired) return;

  try {
    await processQueuedWhatsAppNotifications({ limit: 25 });
  } catch (err) {
    console.error("WHATSAPP_QUEUE ERROR:", err?.message || err);
  } finally {
    await lock.release();
  }
};

if (shouldRunInProcessJobs()) {
  runSubscriptionAutomation();
  setInterval(runSubscriptionAutomation, 60 * 60 * 1000);
  runSubscriptionAutoFail();

  cron.schedule("0 0 * * *", runSubscriptionAutoFail, {
    timezone: "Asia/Kolkata",
  });

  cron.schedule("59 23 * * *", runMonthEndSubscriptionBilling, {
    timezone: "Asia/Kolkata",
  });

  cron.schedule("*/5 * * * *", runWhatsAppNotificationQueue, {
    timezone: "Asia/Kolkata",
  });
} else {
  logger.info("in_process_jobs_disabled");
}

// Handle "Port in use" errors gracefully (from your old app.js)
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${preferredPort} is already in use.`);
    console.error(`👉 Stop the other terminal or change PORT in .env`);
    process.exit(1);
  }
});
