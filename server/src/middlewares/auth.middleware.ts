import { NextFunction, Request, Response } from "express";
import { UserRole } from "@prisma/client";
import { ACCESS_COOKIE_NAME, getCookieValue } from "../modules/auth/auth.cookies.js";
import { ApiError } from "../utils/api-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

export function requireAuth(
  request: Request,
  _response: Response,
  next: NextFunction
) {
  const authorization = request.headers.authorization;
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;
  const cookieToken = getCookieValue(request.headers.cookie, ACCESS_COOKIE_NAME);
  const token = bearerToken ?? cookieToken;

  if (!token) {
    return next(new ApiError(401, "Authentication required"));
  }

  try {
    const payload = verifyAccessToken(token);
    request.authUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.authUser) {
      return next(new ApiError(401, "Authentication required"));
    }

    if (!allowedRoles.includes(request.authUser.role)) {
      return next(new ApiError(403, "You do not have permission for this action"));
    }

    next();
  };
}
