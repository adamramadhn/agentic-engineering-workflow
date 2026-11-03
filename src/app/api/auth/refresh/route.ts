import { clearAuthCookies, rotateRefreshToken } from "@/lib/auth";

/**
 * Rotate the refresh token: the presented token is revoked ('rotated'), a fresh
 * access+refresh pair is issued, and the user is returned.
 *
 * 401 + cleared cookies for: no/garbage/expired token, unknown token, replay of
 * a logged-out or reuse-revoked token (no grace), and non-Active users (whose
 * tokens are all revoked). Replaying a token rotated >30s ago revokes the whole
 * family (reuse detection).
 */
export async function POST() {
  try {
    const outcome = await rotateRefreshToken();
    if (outcome.status === "unauthorized") {
      await clearAuthCookies();
      return Response.json({ error: "Not authenticated" }, { status: 401 });
    }
    return Response.json({ user: outcome.user });
  } catch (error) {
    console.error("refresh failed:", error);
    return Response.json({ error: "Failed to refresh session" }, { status: 500 });
  }
}
