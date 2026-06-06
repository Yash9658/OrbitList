import { Response } from "express";
import { env } from "../../config/env.js";

export const ACCESS_COOKIE_NAME = "orbitlist_access";
export const REFRESH_COOKIE_NAME = "orbitlist_refresh";

function getBaseCookieOptions() {
  return {
    httpOnly: true,
    secure: env.AUTH_COOKIE_SECURE,
    sameSite: env.AUTH_COOKIE_SAME_SITE,
    domain: env.AUTH_COOKIE_DOMAIN || undefined,
    path: "/"
  } as const;
}

export function setAccessTokenCookie(response: Response, accessToken: string) {
  response.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...getBaseCookieOptions(),
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000
  });
}

export function setRefreshTokenCookie(response: Response, refreshToken: string) {
  response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...getBaseCookieOptions(),
    maxAge: env.REFRESH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  });
}

export function clearAuthCookies(response: Response) {
  response.clearCookie(ACCESS_COOKIE_NAME, {
    ...getBaseCookieOptions()
  });
  response.clearCookie(REFRESH_COOKIE_NAME, {
    ...getBaseCookieOptions()
  });
}

export function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(name.length + 1));
}
