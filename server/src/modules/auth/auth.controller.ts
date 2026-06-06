import { Request, Response } from "express";
import {
  clearAuthCookies,
  getCookieValue,
  REFRESH_COOKIE_NAME,
  setAccessTokenCookie,
  setRefreshTokenCookie
} from "./auth.cookies.js";
import {
  getCurrentUser,
  login,
  logout,
  refreshAuthSession,
  signup,
  updateCurrentUserPassword,
  updateCurrentUserProfile,
  updateCurrentUserRole
} from "./auth.service.js";

export async function signupController(request: Request, response: Response) {
  const data = await signup(response.locals.validated.body);
  setAccessTokenCookie(response, data.accessToken);
  setRefreshTokenCookie(response, data.refreshToken);

  response.status(201).json({
    success: true,
    data: data.user
  });
}

export async function loginController(request: Request, response: Response) {
  const data = await login(response.locals.validated.body);
  setAccessTokenCookie(response, data.accessToken);
  setRefreshTokenCookie(response, data.refreshToken);

  response.json({
    success: true,
    data: data.user
  });
}

export async function refreshController(request: Request, response: Response) {
  const refreshToken = getCookieValue(request.headers.cookie, REFRESH_COOKIE_NAME);

  if (!refreshToken) {
    clearAuthCookies(response);
    response.status(401).json({
      success: false,
      message: "Refresh session is missing"
    });
    return;
  }

  const data = await refreshAuthSession(refreshToken);
  setAccessTokenCookie(response, data.accessToken);
  setRefreshTokenCookie(response, data.refreshToken);

  response.json({
    success: true,
    data: data.user
  });
}

export async function logoutController(request: Request, response: Response) {
  const refreshToken = getCookieValue(request.headers.cookie, REFRESH_COOKIE_NAME);
  const data = await logout(refreshToken);

  clearAuthCookies(response);

  response.json({
    success: true,
    data
  });
}

export async function meController(request: Request, response: Response) {
  const data = await getCurrentUser(request.authUser!.id);

  response.json({
    success: true,
    data
  });
}

export async function updateRoleController(
  request: Request,
  response: Response
) {
  const data = await updateCurrentUserRole(
    request.authUser!.id,
    response.locals.validated.body.role
  );
  setAccessTokenCookie(response, data.accessToken);

  response.json({
    success: true,
    data: data.user
  });
}

export async function updateProfileController(
  request: Request,
  response: Response
) {
  const data = await updateCurrentUserProfile(
    request.authUser!.id,
    response.locals.validated.body
  );
  setAccessTokenCookie(response, data.accessToken);

  response.json({
    success: true,
    data: data.user
  });
}

export async function updatePasswordController(
  request: Request,
  response: Response
) {
  const data = await updateCurrentUserPassword(
    request.authUser!.id,
    response.locals.validated.body
  );
  clearAuthCookies(response);

  response.json({
    success: true,
    data
  });
}
