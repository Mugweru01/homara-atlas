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
    const config = RATE_LIMITS[type];
    const key = `rate_limit:admin:${type}:${identifier}`;
    
    // Get current count
    const currentStr = await redisHelpers.get(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;
    
    const now = Date.now();
    const resetAt = now + (config.windowSeconds * 1000);
    
    // Check if limit exceeded
    if (current >= config.maxAttempts) {
      const ttl = await redisHelpers.ttl(key);
      const retryAfter = ttl > 0 ? ttl : config.windowSeconds;
      
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
    const newCount = await redisHelpers.incr(key);
    
    // Set expiry on first increment
    if (newCount === 1) {
      await redisHelpers.expire(key, config.windowSeconds);
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
    await redisHelpers.incr(key);
    await redisHelpers.expire(key, 3600); // 1 hour
  } catch (error) {
    logger.error('Failed to record login attempt', { error, email });
  }
}

/**
 * Get failed login count
 */
export async function getFailedLoginCount(email: string): Promise<number> {
  const key = `failed_logins:${email}`;
  try {
    const countStr = await redisHelpers.get(key);
    return countStr ? parseInt(countStr, 10) : 0;
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
    await redisHelpers.del(key);
  } catch (error) {
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

