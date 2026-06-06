import { apiRequest } from "../lib/api-client";
import {
  AuthUser,
  NotificationPreferences,
  PasswordUpdateResult,
  UserRole
} from "../types/auth";

export function loginRequest(input: { email: string; password: string }) {
  return apiRequest<AuthUser>("/auth/login", {
    method: "POST",
    body: input
  });
}

export function signupRequest(input: {
  email: string;
  password: string;
  fullName: string;
  username?: string;
  country?: string;
  role: UserRole;
}) {
  return apiRequest<AuthUser>("/auth/signup", {
    method: "POST",
    body: input
  });
}

export function meRequest() {
  return apiRequest<AuthUser>("/auth/me");
}

export function refreshSessionRequest() {
  return apiRequest<AuthUser>("/auth/refresh", {
    method: "POST"
  });
}

export function logoutRequest() {
  return apiRequest<{ success: boolean }>("/auth/logout", {
    method: "POST"
  });
}

export function updateRoleRequest(role: UserRole) {
  return apiRequest<AuthUser>("/auth/role", {
    method: "PATCH",
    body: { role }
  });
}

export function updateProfileRequest(input: {
  fullName: string;
  username?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  country?: string | null;
  role?: UserRole;
  notificationPreferences?: NotificationPreferences;
}) {
  return apiRequest<AuthUser>("/auth/profile", {
    method: "PATCH",
    body: input
  });
}

export function updatePasswordRequest(input: {
  currentPassword: string;
  nextPassword: string;
}) {
  return apiRequest<PasswordUpdateResult>("/auth/password", {
    method: "PATCH",
    body: input
  });
}
