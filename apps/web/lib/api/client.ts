import { getSession } from "next-auth/react";

const API_PROXY_PREFIX = "/api/proxy";

function errorMessage(status: number, body: unknown): string {
  if (
    body &&
    typeof body === "object" &&
    "detail" in body &&
    typeof body.detail === "string"
  ) {
    return body.detail;
  }
  return `API ${status}`;
}

export class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(errorMessage(status, body));
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const session = await getSession();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${API_PROXY_PREFIX}${normalizedPath}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
