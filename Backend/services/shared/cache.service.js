import { getRedisConnection } from "../../config/redis.js";
import { logger } from "../../utils/logger.js";

const memoryCache = new Map();

const getMemoryValue = (key) => {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return cached.value;
};

export const getJsonCache = async (key) => {
  const redis = getRedisConnection();
  if (!redis) return getMemoryValue(key);

  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    logger.warn("redis_cache_get_failed", { key, error: err.message });
    return getMemoryValue(key);
  }
};

export const setJsonCache = async (key, value, ttlSeconds = 30) => {
  const redis = getRedisConnection();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  memoryCache.set(key, { value, expiresAt });

  if (!redis) return;

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn("redis_cache_set_failed", { key, error: err.message });
  }
};

export const deleteCache = async (key) => {
  memoryCache.delete(key);
  const redis = getRedisConnection();
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (err) {
    logger.warn("redis_cache_delete_failed", { key, error: err.message });
  }
};

export const deleteCacheByPrefix = async (prefix) => {
  for (const key of memoryCache.keys()) {
    if (String(key).startsWith(prefix)) memoryCache.delete(key);
  }

  const redis = getRedisConnection();
  if (!redis) return;

  try {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== "0");
  } catch (err) {
    logger.warn("redis_cache_prefix_delete_failed", { prefix, error: err.message });
  }
};
