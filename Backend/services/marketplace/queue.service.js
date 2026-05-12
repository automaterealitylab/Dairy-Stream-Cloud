import { Queue, QueueEvents } from "bullmq";
import { getRedisConnection, isRedisEnabled } from "../../config/redis.js";
import { logger, logError } from "../../utils/logger.js";
import { metrics } from "../../utils/metrics.js";

export const QUEUE_NAMES = {
  webhooks: "marketplace:webhooks",
  settlements: "marketplace:settlements",
  reconciliation: "marketplace:reconciliation",
  retries: "marketplace:retries",
  notifications: "marketplace:notifications",
};

const queueCache = new Map();

export const isQueueEnabled = () => isRedisEnabled();

export const getQueue = (name) => {
  if (!isQueueEnabled()) return null;
  if (queueCache.has(name)) return queueCache.get(name);
  const queue = new Queue(name, {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: Number(process.env.QUEUE_JOB_ATTEMPTS || 7),
      backoff: {
        type: "exponential",
        delay: Number(process.env.QUEUE_JOB_BACKOFF_MS || 5000),
      },
      removeOnComplete: Number(process.env.QUEUE_REMOVE_ON_COMPLETE || 1000),
      removeOnFail: Number(process.env.QUEUE_REMOVE_ON_FAIL || 5000),
    },
  });
  queueCache.set(name, queue);
  return queue;
};

export const enqueueMarketplaceJob = async ({
  queueName,
  name,
  data,
  jobId,
  delay = 0,
  priority,
}) => {
  const queue = getQueue(queueName);
  if (!queue) return { queued: false, fallback: true };
  const job = await queue.add(name, data, {
    jobId,
    delay,
    priority,
  });
  metrics.increment("queue_jobs_enqueued", { queue: queueName, job: name });
  return { queued: true, jobId: job.id, queueName };
};

export const getQueueStats = async () => {
  if (!isQueueEnabled()) return { enabled: false, queues: [] };
  const rows = [];
  for (const queueName of Object.values(QUEUE_NAMES)) {
    const queue = getQueue(queueName);
    const counts = await queue.getJobCounts("waiting", "active", "delayed", "completed", "failed", "paused");
    for (const [status, count] of Object.entries(counts)) {
      metrics.gauge("queue_jobs", { queue: queueName, status }, count);
    }
    rows.push({ name: queueName, counts });
  }
  return { enabled: true, queues: rows };
};

export const startQueueEventTelemetry = () => {
  if (!isQueueEnabled()) {
    logger.warn("queue_telemetry_disabled", { reason: "REDIS_URL/REDIS_ENABLED not configured" });
    return [];
  }

  return Object.values(QUEUE_NAMES).map((queueName) => {
    const events = new QueueEvents(queueName, { connection: getRedisConnection() });
    events.on("completed", ({ jobId }) => metrics.increment("queue_jobs_completed", { queue: queueName }));
    events.on("failed", ({ jobId, failedReason }) => {
      metrics.increment("queue_jobs_failed", { queue: queueName });
      logger.warn("queue_job_failed", { queueName, jobId, failedReason });
    });
    events.on("error", (err) => logError("queue_events_error", err, { queueName }));
    return events;
  });
};
