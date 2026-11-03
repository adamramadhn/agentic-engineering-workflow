/**
 * JWT signing/verification for the access + refresh token pair.
 *
 * Edge-safe by construction: only `jose` is imported — never `pg`/`./db` — so
 * the proxy can verify tokens without a database.
 *
 * Payloads:
 *   access:  { sub, email, role, type: "access" }
 *   refresh: { sub, jti, type: "refresh" }
 */
import { SignJWT, jwtVerify, decodeJwt, errors } from "jose";

const AUTH_SECRET = process.env.AUTH_SECRET;

/**
 * Fail fast at module load (mirrors the DATABASE_URL check in db.ts): a missing
 * signing key must be a boot failure an operator can act on, not an opaque
 * 500/401 on every request.
 */
if (!AUTH_SECRET) {
  throw new Error("AUTH_SECRET is not set. Add it to .env.local");
}

/** Access tokens live 15 minutes; the client silently refreshes after that. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Refresh tokens live 7 days and rotate on every use. */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const ISSUER = "onyx-auth";

function getSigningKey(): Uint8Array {
  return new TextEncoder().encode(AUTH_SECRET);
}

export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: string;
  type: "access";
}

export interface RefreshTokenClaims {
  sub: string;
  jti: string;
  type: "refresh";
}

export async function signAccessToken(user: {
  id: string;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSigningKey());
}

export async function signRefreshToken(userId: string, jti: string): Promise<string> {
  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(jti)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(getSigningKey());
}

/** Verify an access JWT (signature, issuer, expiry) and return its claims. */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), { issuer: ISSUER });
    if (payload.type !== "access" || typeof payload.sub !== "string") return null;
    return payload as unknown as AccessTokenClaims;
  } catch {
    return null;
  }
}

/** Verify a refresh JWT (signature, issuer, expiry) and return its claims. */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), { issuer: ISSUER });
    if (payload.type !== "refresh" || typeof payload.sub !== "string") return null;
    if (typeof payload.jti !== "string" || !payload.jti) return null;
    return payload as unknown as RefreshTokenClaims;
  } catch {
    return null;
  }
}

export type AccessTokenStatus = "valid" | "expired" | "invalid";

/**
 * Triage an access token for routing purposes (used by the proxy).
 *
 * - "valid":   signed by us, of type access, and not expired
 * - "expired": signed by us and of type access, but past its `exp`. The proxy
 *              still serves the page shell — the client then silently refreshes.
 *              The type check matters: a JWTExpired thrown for any other token
 *              type (e.g. an expired refresh JWT planted as the access cookie)
 *              must fall through to "invalid", never "expired".
 * - "invalid": everything else (garbage, wrong key, wrong type).
 *
 * This is a routing hint only — data APIs always re-verify strictly via
 * `verifyAccessToken`/`getSessionUser`.
 */
export async function verifyAccessTokenStatus(token: string): Promise<AccessTokenStatus> {
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), { issuer: ISSUER });
    return payload.type === "access" && typeof payload.sub === "string" ? "valid" : "invalid";
  } catch (error) {
    if (error instanceof errors.JWTExpired) {
      // Only trust the "expired" verdict when the token really is an access token.
      const payload = decodeTokenClaims(token);
      return payload?.type === "access" ? "expired" : "invalid";
    }
    return "invalid";
  }
}

/**
 * Unverified decode of a JWT's payload — signature is NOT checked.
 *
 * Used by logout to extract the `jti` of the refresh cookie so its DB row can
 * be revoked. Safe here because the extracted jti is only ever used to build a
 * sha256 hash looked up in `refresh_tokens` (rows that only exist for tokens we
 * signed), and verifying instead would make logout fail for an expired token,
 * leaving a revocable row un-revoked. Never use this for authorization.
 */
export function decodeTokenClaims(
  token: string
): { sub?: string; jti?: string; type?: string } | null {
  try {
    const decoded = decodeJwt(token);
    if (!decoded) return null;
    return {
      sub: typeof decoded.sub === "string" ? decoded.sub : undefined,
      jti: typeof decoded.jti === "string" ? decoded.jti : undefined,
      type: typeof decoded.type === "string" ? decoded.type : undefined,
    };
  } catch {
    return null;
  }
}
