const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? `${window.location.protocol}//${window.location.hostname}:4001` : "http://localhost:4001");

export function getApiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getAuthToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("jwt");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  // Content-Type header for JSON requests
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // No Authorization header; HttpOnly cookie will be sent automatically by the browser

  const response = await fetch(getApiUrl(path), {
    ...options,
    headers,
    credentials: 'include', // ensure cookies are included
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data?.message || response.statusText || "API request failed.";
    throw new Error(error);
  }

  return data;
}
