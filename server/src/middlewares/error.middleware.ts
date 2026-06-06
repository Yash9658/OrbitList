import { NextFunction, Request, Response } from "express";
import { captureServerError } from "../config/monitoring.js";
import { ApiError } from "../utils/api-error.js";
import { logError, logWarn } from "../utils/logger.js";

export function errorMiddleware(
  error: Error,
  request: Request,
  response: Response,
  _next: NextFunction
) {
  if (error instanceof ApiError) {
    logWarn("request_failed", {
      requestId: request.requestId ?? null,
      method: request.method,
      path: request.originalUrl,
      statusCode: error.statusCode,
      errorMessage: error.message,
      userId: request.authUser?.id ?? null
    });

    return response.status(error.statusCode).json({
      success: false,
      message: error.message,
      requestId: request.requestId ?? null
    });
  }

  logError("unhandled_error", {
    requestId: request.requestId ?? null,
    method: request.method,
    path: request.originalUrl,
    errorMessage: error.message,
    stack: error.stack,
    userId: request.authUser?.id ?? null
  });
  captureServerError(error, {
    requestId: request.requestId ?? null,
    method: request.method,
    path: request.originalUrl,
    userId: request.authUser?.id ?? null
  });

  return response.status(500).json({
    success: false,
    message: "Internal server error",
    requestId: request.requestId ?? null
  });
}
