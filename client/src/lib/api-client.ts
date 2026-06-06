const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
};

export class ApiRequestError extends Error {
  status: number;
  errors?: unknown;
  issues?: unknown;

  constructor(message: string, status: number, errors?: unknown, issues?: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.errors = errors;
    this.issues = issues;
  }
}

const NON_REFRESHABLE_PATHS = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/refresh",
  "/auth/logout"
]);

let refreshPromise: Promise<boolean> | null = null;
const REQUEST_TIMEOUT_MS = 15000;

function emitAuthExpired() {
  window.dispatchEvent(new CustomEvent("orbitlist:auth-expired"));
}

async function attemptSessionRefresh() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      }
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
  retryOnUnauthorized = true
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError("Request timed out. Check if the backend server is running.", 408);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    success: boolean;
    message?: string;
    data?: T;
    errors?: unknown;
    issues?: unknown;
  } & Record<string, unknown>;

  if (
    response.status === 401 &&
    retryOnUnauthorized &&
    !NON_REFRESHABLE_PATHS.has(path)
  ) {
    const refreshed = await attemptSessionRefresh();

    if (refreshed) {
      return apiRequest<T>(path, options, false);
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      emitAuthExpired();
    }

    throw new ApiRequestError(
      payload.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload.errors,
      payload.issues
    );
  }

  if ("data" in payload && payload.data !== undefined) {
    const {
      success: _success,
      message: _message,
      data,
      ...rest
    } = payload as {
      success: boolean;
      message?: string;
      data: unknown;
    } & Record<string, unknown>;

    if (Object.keys(rest).length > 0) {
      return {
        data,
        ...rest
      } as T;
    }

    return data as T;
  }

  const { success: _success, message: _message, ...rest } = payload;

  return rest as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}
