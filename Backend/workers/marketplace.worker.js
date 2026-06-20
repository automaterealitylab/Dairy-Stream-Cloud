import "../config/loadEnv.js";
import { validateRuntimeEnv } from "../config/envValidation.js";
import { startMarketplaceWorkers } from "../services/marketplace/queueWorkers.service.js";
import { logger } from "../utils/logger.js";

validateRuntimeEnv();
const workers = startMarketplaceWorkers();
logger.info("marketplace_worker_process_started", { workers: workers.length });

const shutdown = async () => {
  logger.info("marketplace_worker_shutdown_started");
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
