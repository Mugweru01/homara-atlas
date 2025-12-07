/**
 * Admin Rate Limiter
 * 
 * Distributed rate limiting for admin endpoints using Redis.
 * Prevents brute force attacks on admin login and API abuse.
 */

import { redisHelpers } from './redis';
import { logger } from './production-logger';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Rate limit configuration for different admin actions
 */
const RATE_LIMITS = {
  // Admin login - strict limit to prevent brute force
  admin_login: {
    maxAttempts: 5,
    windowSeconds: 900, // 15 minutes
  },
  // Admin API calls - generous limit for normal usage
  admin_api: {
    maxAttempts: 100,
    windowSeconds: 60, // 1 minute
  },
  // Property approval actions
  property_action: {
    maxAttempts: 50,
    windowSeconds: 60,
  },
  // User management actions
  user_action: {
    maxAttempts: 30,
    windowSeconds: 60,
  },
} as const;

type RateLimitType = keyof typeof RATE_LIMITS;

/**
 * Check if an action is rate limited
 * 
 * @param identifier - Unique identifier (email, IP, user ID)
 * @param type - Type of rate limit to apply
 * @returns Rate limit result
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'admin_api'
): Promise<RateLimitResult> {
  try {
    // Check if Redis is available (browser environment check)
    const url = import.meta.env.VITE_UPSTASH_REDIS_REST_URL;
    const token = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      // Redis not configured - allow request (fail open)
      logger.warn('Redis not configured, skipping rate limit', { identifier, type });
      return {
        allowed: true,
        remaining: -1,
        resetAt: Date.now() + 60000,
      };
    }

    const config = RATE_LIMITS[type];
    const key = `rate_limit:admin:${type}:${identifier}`;
    
    // Try to get current count, but fail gracefully if Redis is unavailable
    let current = 0;
    try {
      const currentStr = await redisHelpers.get(key);
      current = currentStr ? parseInt(String(currentStr), 10) : 0;
    } catch (redisError) {
      // Redis connection failed - allow request (fail open)
      logger.warn('Redis connection failed, skipping rate limit', { error: redisError, identifier, type });
      return {
        allowed: true,
        remaining: -1,
        resetAt: Date.now() + 60000,
      };
    }
    
    const now = Date.now();
    const resetAt = now + (config.windowSeconds * 1000);
    
    // Check if limit exceeded
    if (current >= config.maxAttempts) {
      let retryAfter = config.windowSeconds;
      try {
        const ttl = await redisHelpers.ttl(key);
        retryAfter = ttl > 0 ? ttl : config.windowSeconds;
      } catch (ttlError) {
        // If TTL check fails, use default window
        logger.warn('Failed to get TTL, using default', { error: ttlError });
      }
      
      logger.warn('Rate limit exceeded', {
        identifier,
        type,
        current,
        max: config.maxAttempts,
        retryAfter,
      });
      
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }
    
    // Increment counter
    let newCount = 1;
    try {
      newCount = await redisHelpers.incr(key);
      
      // Set expiry on first increment
      if (newCount === 1) {
        await redisHelpers.expire(key, config.windowSeconds);
      }
    } catch (incrError) {
      // If increment fails, allow the request (fail open)
      logger.warn('Failed to increment rate limit counter', { error: incrError });
      return {
        allowed: true,
        remaining: -1,
        resetAt: Date.now() + 60000,
      };
    }
    
    return {
      allowed: true,
      remaining: config.maxAttempts - newCount,
      resetAt,
    };
  } catch (error) {
    // On Redis error, allow the request (fail open)
    logger.error('Rate limit check failed', { error, identifier, type });
    return {
      allowed: true,
      remaining: -1,
      resetAt: Date.now() + 60000,
    };
  }
}

/**
 * Record a failed admin login attempt
 */
export async function recordFailedLogin(email: string): Promise<void> {
  const key = `failed_logins:${email}`;
  try {
    // Check if Redis is available
    const url = import.meta.env.VITE_UPSTASH_REDIS_REST_URL;
    const token = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      // Redis not configured - skip recording (fail silently)
      return;
    }

    await redisHelpers.incr(key);
    await redisHelpers.expire(key, 3600); // 1 hour
  } catch (error) {
    // Fail silently - don't block login if Redis fails
    logger.error('Failed to record login attempt', { error, email });
  }
}

/**
 * Get failed login count
 */
export async function getFailedLoginCount(email: string): Promise<number> {
  const key = `failed_logins:${email}`;
  try {
    // Check if Redis is available
    const url = import.meta.env.VITE_UPSTASH_REDIS_REST_URL;
    const token = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      return 0;
    }

    const countStr = await redisHelpers.get(key);
    return countStr ? parseInt(String(countStr), 10) : 0;
  } catch (error) {
    logger.error('Failed to get login count', { error, email });
    return 0;
  }
}

/**
 * Clear failed login attempts (on successful login)
 */
export async function clearFailedLogins(email: string): Promise<void> {
  const key = `failed_logins:${email}`;
  try {
    // Check if Redis is available
    const url = import.meta.env.VITE_UPSTASH_REDIS_REST_URL;
    const token = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      // Redis not configured - skip clearing (fail silently)
      return;
    }

    await redisHelpers.del(key);
  } catch (error) {
    // Fail silently - don't block login if Redis fails
    logger.error('Failed to clear login attempts', { error, email });
  }
}

/**
 * Middleware-style rate limiter for React components
 */
export function useRateLimiter() {
  return {
    checkLimit: checkRateLimit,
    recordFailure: recordFailedLogin,
    getFailureCount: getFailedLoginCount,
    clearFailures: clearFailedLogins,
  };
}

