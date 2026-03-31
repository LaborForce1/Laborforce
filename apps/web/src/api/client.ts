const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new Error("LaborForce API is offline. Start the API server and try again.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string, token?: string | null) {
  return apiRequest<T>(path, { token });
}

export function apiPost<T>(path: string, body: unknown, token?: string | null) {
  return apiRequest<T>(path, { method: "POST", body, token });
}

export function apiPatch<T>(path: string, body: unknown, token?: string | null) {
  return apiRequest<T>(path, { method: "PATCH", body, token });
}
