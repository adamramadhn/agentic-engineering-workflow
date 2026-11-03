/**
 * Client-side fetch wrapper for authenticated API calls.
 *
 * Retries exactly once after a silent token refresh when a request comes back
 * 401 (the 15-minute access token expires while the 7-day refresh token is
 * still valid). The refresh POST is single-flight per module: concurrent 401s
 * share one request, because two parallel refreshes with the same token would
 * otherwise trip reuse detection and log the user out.
 */

/**
 * Endpoints that must never trigger a refresh-retry: the refresh call itself
 * (infinite loop) and the credential endpoints, where a 401 is a wrong
 * password — not a stale token. `/api/auth/me` is deliberately absent: it is a
 * protected read like any other and should silently refresh.
 */
const NO_REFRESH_ENDPOINTS = new Set([
  "/api/auth/refresh",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
]);

let refreshInFlight: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST" })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  // Hard navigation on purpose: the session is gone, so all client state should
  // be discarded rather than kept around a dead session. useRouter() is not
  // available in a plain (non-component) module like this one, and a soft
  // navigation would leave stale authenticated UI mounted.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/login");
}

/** fetch() with one silent refresh-and-retry on 401. */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  // Credential endpoints decide auth themselves (a failed login is not a stale token).
  if (NO_REFRESH_ENDPOINTS.has(input)) return response;

  const refreshed = await refreshSession();
  if (!refreshed) {
    redirectToLogin();
    return response;
  }
  return fetch(input, init);
}
