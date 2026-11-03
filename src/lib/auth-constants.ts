/**
 * Cookie names shared between the proxy and server/client code.
 * Kept free of Node-only imports (and of jose) so it is safe everywhere,
 * including the proxy module graph.
 */
export const ACCESS_COOKIE = "onyx_access";
export const REFRESH_COOKIE = "onyx_refresh";

/** The refresh cookie is only ever sent to auth endpoints. */
export const REFRESH_COOKIE_PATH = "/api/auth";
