import { Worker } from "bullmq";
import { acquireRedisLock, getRedisConnection, isRedisEnabled } from "../../config/redis.js";
import { logger, logError } from "../../utils/logger.js";
import { metrics } from "../../utils/metrics.js";
import { processStoredMarketplaceWebhook } from "./marketplace.service.js";
import {
  processPendingWebhookRetries,
  runMarketplaceReconciliation,
  verifyOrderSettlement,
} from "./reconciliation.service.js";
import { QUEUE_NAMES, startQueueEventTelemetry } from "./queue.service.js";

const concurrency = Number(process.env.QUEUE_WORKER_CONCURRENCY || 5);

const processorByQueue = {
  [QUEUE_NAMES.webhooks]: async (job) => processStoredMarketplaceWebhook(job.data),
  [QUEUE_NAMES.settlements]: async (job) => verifyOrderSettlement(job.data.razorpayOrderId),
  [QUEUE_NAMES.reconciliation]: async (job) => runMarketplaceReconciliation(job.data || {}),
  [QUEUE_NAMES.retries]: async (job) => processPendingWebhookRetries(job.data || {}),
  [QUEUE_NAMES.notifications]: async (job) => ({ delivered: false, reason: "notification adapter not configured", data: job.data }),
};

export const startMarketplaceWorkers = () => {
  if (!isRedisEnabled()) {
    logger.warn("marketplace_workers_disabled", { reason: "Redis is not configured" });
    return [];
  }

  startQueueEventTelemetry();

  return Object.entries(processorByQueue).map(([queueName, processor]) => {
    const worker = new Worker(
      queueName,
      async (job) => {
        const lock = await acquireRedisLock({
          key: `job:${queueName}:${job.id}`,
          ttlMs: Number(process.env.DISTRIBUTED_LOCK_TTL_MS || 120_000),
        });
        if (!lock.acquired) return { skipped: true, reason: "lock_not_acquired" };

        const started = Date.now();
        try {
          const result = await processor(job);
          metrics.observe("queue_job_duration_ms", { queue: queueName, job: job.name }, Date.now() - started);
          return result;
        } finally {
          await lock.release();
        }
      },
      {
        connection: getRedisConnection(),
        concurrency,
        limiter: {
          max: Number(process.env.QUEUE_WORKER_RATE_LIMIT_MAX || 100),
          duration: Number(process.env.QUEUE_WORKER_RATE_LIMIT_DURATION_MS || 1000),
        },
      }
    );

    worker.on("ready", () => logger.info("marketplace_worker_ready", { queueName }));
    worker.on("failed", (job, err) => logError("marketplace_worker_job_failed", err, { queueName, jobId: job?.id }));
    worker.on("error", (err) => logError("marketplace_worker_error", err, { queueName }));
    return worker;
  });
};
