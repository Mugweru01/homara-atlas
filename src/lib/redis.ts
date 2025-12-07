import { Redis } from "@upstash/redis";
import { logger } from '@/lib/production-logger';

// Lazy initialization to avoid browser issues
let redisInstance: Redis | null = null;

/**
 * Get Redis client instance (lazy initialization)
 * Safe to use in both browser and server environments
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    // Check if we have the required environment variables
    const url = import.meta.env.VITE_UPSTASH_REDIS_REST_URL;
    const token = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error(
        "Redis configuration missing. Add VITE_UPSTASH_REDIS_REST_URL and VITE_UPSTASH_REDIS_REST_TOKEN to your .env.local file",
      );
    }

    try {
      // Check if we're in a browser environment
      const isBrowser = typeof window !== 'undefined';
      
      // Create Redis instance with explicit browser-safe configuration
      // Upstash Redis REST API works in browsers, but we need to ensure
      // it doesn't try to access Node.js-specific globals
      redisInstance = new Redis({
        url,
        token,
      });
    } catch (error) {
      logger.error('Failed to initialize Redis client', { error });
      // In browser, if Redis fails to initialize, we'll handle it gracefully
      // in the calling code (rate limiter will fail open)
      throw error;
    }
  }

  return redisInstance;
}

// Export redis as a getter for backward compatibility
// This proxy lazily initializes Redis only when accessed
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    try {
      return getRedis()[prop as keyof Redis];
    } catch (error) {
      // If Redis initialization fails (e.g., in browser without proper config),
      // return a no-op function to prevent errors
      if (typeof prop === 'string' && typeof ({} as any)[prop] === 'function') {
        return () => Promise.resolve(null);
      }
      throw error;
    }
  },
});

// Helper functions for common Redis operations
export const redisHelpers = {
  /**
   * Set a value with expiration time
   * @param key - Redis key
   * @param seconds - Expiration time in seconds
   * @param value - Value to store (will be JSON stringified)
   */
  async setex(key: string, seconds: number, value: unknown) {
    return await getRedis().setex(key, seconds, JSON.stringify(value));
  },

  /**
   * Get and parse JSON value
   * @param key - Redis key
   * @returns Parsed value or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    const data = await getRedis().get(key);
    if (!data) return null;
    if (typeof data !== "string") return data;

    // Try to parse as JSON, if it fails, return as-is
    try {
      return JSON.parse(data);
    } catch {
      // If not valid JSON, return the raw value
      return data as T;
    }
  },

  /**
   * Set a value without expiration
   * @param key - Redis key
   * @param value - Value to store (will be JSON stringified)
   */
  async set(key: string, value: unknown) {
    return await getRedis().set(key, JSON.stringify(value));
  },

  /**
   * Increment a counter
   * @param key - Redis key
   * @returns New value after increment
   */
  async incr(key: string) {
    return await getRedis().incr(key);
  },

  /**
   * Increment by a specific amount
   * @param key - Redis key
   * @param increment - Amount to increment by
   * @returns New value after increment
   */
  async incrby(key: string, increment: number) {
    return await getRedis().incrby(key, increment);
  },

  /**
   * Set expiration on an existing key
   * @param key - Redis key
   * @param seconds - Expiration time in seconds
   */
  async expire(key: string, seconds: number) {
    return await getRedis().expire(key, seconds);
  },

  /**
   * Delete one or more keys
   * @param keys - Redis keys to delete
   */
  async del(...keys: string[]) {
    return await getRedis().del(...keys);
  },

  /**
   * Get multiple keys at once
   * @param keys - Redis keys to fetch
   * @returns Array of parsed values (null for missing keys)
   */
  async mget<T>(...keys: string[]): Promise<(T | null)[]> {
    if (keys.length === 0) return [];
    const values = await getRedis().mget(...keys);
    return values.map((v) => {
      if (!v) return null;
      if (typeof v !== "string") return v;

      // Try to parse as JSON, if it fails, return as-is
      try {
        return JSON.parse(v);
      } catch {
        // If not valid JSON, return the raw value
        return v as T;
      }
    });
  },

  /**
   * Check if a key exists
   * @param key - Redis key
   * @returns true if key exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    return (await getRedis().exists(key)) === 1;
  },

  /**
   * Get time to live for a key
   * @param key - Redis key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    return await getRedis().ttl(key);
  },

  /**
   * Hash operations - set field in hash
   * @param key - Redis key
   * @param field - Hash field
   * @param value - Value to store
   */
  async hset(key: string, field: string, value: unknown) {
    return await getRedis().hset(key, { [field]: JSON.stringify(value) });
  },

  /**
   * Hash operations - get field from hash
   * @param key - Redis key
   * @param field - Hash field
   */
  async hget<T>(key: string, field: string): Promise<T | null> {
    const data = await getRedis().hget(key, field);
    if (!data) return null;
    if (typeof data !== "string") return data;

    // Try to parse as JSON, if it fails, return as-is
    try {
      return JSON.parse(data);
    } catch {
      return data as T;
    }
  },

  /**
   * Hash operations - increment field in hash
   * @param key - Redis key
   * @param field - Hash field
   * @param increment - Amount to increment by
   */
  async hincrby(key: string, field: string, increment: number) {
    return await getRedis().hincrby(key, field, increment);
  },

  /**
   * Hash operations - get all fields and values
   * @param key - Redis key
   */
  async hgetall<T>(key: string): Promise<Record<string, T>> {
    const data = await getRedis().hgetall(key);
    if (!data) return {};

    const result: Record<string, T> = {};
    for (const [field, value] of Object.entries(data)) {
      if (typeof value !== "string") {
        result[field] = value;
      } else {
        try {
          result[field] = JSON.parse(value);
        } catch {
          result[field] = value as T;
        }
      }
    }
    return result;
  },
};

/**
 * Cache wrapper for Supabase queries
 * @param cacheKey - Unique cache key
 * @param queryFn - Function that returns the data to cache
 * @param ttlSeconds - Time to live in seconds (default: 5 minutes)
 * @returns Cached data or fresh data if cache miss
 */
export async function getCachedQuery<T>(
  cacheKey: string,
  queryFn: () => Promise<T>,
  ttlSeconds: number = 300,
): Promise<T> {
  try {
    // Try to get from cache first
    const cached = await redisHelpers.get<T>(cacheKey);
    if (cached !== null) {
      logger.debug(`📦 Cache HIT: ${cacheKey}`);
      return cached;
    }
  } catch (error) {
    logger.warn("⚠️ Cache read error:", error);
  }

  logger.debug(`🔄 Cache MISS: ${cacheKey}`);
  // If not in cache, execute query
  const result = await queryFn();

  // Store in cache
  try {
    await redisHelpers.setex(cacheKey, ttlSeconds, result);
    logger.debug(`✅ Cached: ${cacheKey} (TTL: ${ttlSeconds}s)`);
  } catch (error) {
    logger.warn("⚠️ Cache write error:", error);
  }

  return result;
}

/**
 * Invalidate cache by pattern
 * Note: This requires Redis SCAN command which may not be available in all Upstash plans
 * @param pattern - Key pattern to invalidate (e.g., "properties:*")
 */
export async function invalidateCache(pattern: string) {
  try {
    // For Upstash, we need to manually track keys or use a set
    // This is a simplified version that requires you to track keys
    logger.warn(
      `⚠️ Cache invalidation for pattern "${pattern}" - implement key tracking if needed`,
    );
  } catch (error) {
    logger.error("❌ Cache invalidation error:", error);
  }
}
