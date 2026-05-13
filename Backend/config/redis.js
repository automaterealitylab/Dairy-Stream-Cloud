import IORedis from "ioredis";
import { logger, logError } from "../utils/logger.js";

let sharedConnection = null;

export const isRedisEnabled = () => {
  const redisEnabled = String(process.env.REDIS_ENABLED || "").trim().toLowerCase();
  if (redisEnabled === "false") return false;
  if (redisEnabled === "true") return true;
  return Boolean(String(process.env.REDIS_URL || "").trim());
};

export const getRedisConnection = () => {
  if (!isRedisEnabled()) return null;
  if (sharedConnection) return sharedConnection;

  sharedConnection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  });

  sharedConnection.on("connect", () => logger.info("redis_connected"));
  sharedConnection.on("error", (err) => logError("redis_error", err));
  return sharedConnection;
};

export const acquireRedisLock = async ({ key, ttlMs = 30_000, owner }) => {
  const redis = getRedisConnection();
  if (!redis) return { acquired: true, release: async () => {} };
  const lockOwner = owner || `${process.pid}:${Date.now()}`;
  const result = await redis.set(`lock:${key}`, lockOwner, "PX", ttlMs, "NX");
  return {
    acquired: result === "OK",
    release: async () => {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        end
        return 0
      `;
      await redis.eval(script, 1, `lock:${key}`, lockOwner);
    },
  };
};
