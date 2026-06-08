export const TOKEN_KEY = "nyadio_admin_token";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRole(): "SUPERADMIN" | "MODERATOR" | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return payload.role === "SUPERADMIN" || payload.role === "MODERATOR" ? payload.role : null;
  } catch {
    return null;
  }
}

export function getAdminId(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    return typeof payload.id === "string" ? payload.id : null;
  } catch {
    return null;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(path, { ...init, headers });
  if (response.status === 401) {
    clearToken();
    if (location.pathname !== "/admin/login") location.assign("/admin/login");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    const details =
      Array.isArray(payload.details) && payload.details.length > 0
        ? `：${payload.details.map((item: { path?: string; message?: string }) => `${item.path || "字段"} ${item.message || ""}`).join("；")}`
        : "";
    throw new ApiError(response.status, `${payload.error ?? response.statusText}${details}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
