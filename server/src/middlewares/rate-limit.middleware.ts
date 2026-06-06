import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";

type RateLimitConfig = {
  key: string;
  maxRequests: number;
  windowMs: number;
  getIdentifier?: (request: Request) => string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

function cleanupExpiredEntries(now: number) {
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function createRateLimitMiddleware(config: RateLimitConfig) {
  return (request: Request, response: Response, next: NextFunction) => {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const identifier = config.getIdentifier?.(request) ?? request.ip ?? "unknown";
    const storeKey = `${config.key}:${identifier}`;
    const existing = rateLimitStore.get(storeKey);

    if (!existing || existing.resetAt <= now) {
      rateLimitStore.set(storeKey, {
        count: 1,
        resetAt: now + config.windowMs
      });
      response.setHeader("X-RateLimit-Limit", String(config.maxRequests));
      response.setHeader("X-RateLimit-Remaining", String(config.maxRequests - 1));
      return next();
    }

    if (existing.count >= config.maxRequests) {
      const retryAfterSeconds = Math.max(Math.ceil((existing.resetAt - now) / 1000), 1);

      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.setHeader("X-RateLimit-Limit", String(config.maxRequests));
      response.setHeader("X-RateLimit-Remaining", "0");

      return next(
        new ApiError(
          429,
          "Too many requests. Please wait a moment before trying again."
        )
      );
    }

    existing.count += 1;
    rateLimitStore.set(storeKey, existing);
    response.setHeader("X-RateLimit-Limit", String(config.maxRequests));
    response.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(config.maxRequests - existing.count, 0))
    );

    return next();
  };
}
