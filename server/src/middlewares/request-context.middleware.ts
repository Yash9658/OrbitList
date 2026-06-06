import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { logInfo } from "../utils/logger.js";

export function requestContextMiddleware(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const requestId = request.get("x-request-id")?.trim() || randomUUID();
  const startedAt = Date.now();

  request.requestId = requestId;
  response.setHeader("x-request-id", requestId);

  response.on("finish", () => {
    logInfo("request_completed", {
      requestId,
      method: request.method,
      path: request.originalUrl,
      statusCode: response.statusCode,
      durationMs: Date.now() - startedAt,
      ip: request.ip,
      userId: request.authUser?.id ?? null
    });
  });

  next();
}
