import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth-constants";
import { verifyAccessTokenStatus } from "@/lib/jwt";

/** Workspace routes that require a signed-in session. The admin pages join the
 *  list now that they exist: an anonymous visitor is redirected before any
 *  session-dependent rendering runs. */
const PROTECTED_PREFIXES = [
  "/users",
  "/agent-board",
  "/ask-ai",
  "/watching",
  "/wiki",
  "/storage",
  "/roles",
  "/permissions",
];

/** Auth pages a signed-in user has no business visiting. */
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

/**
 * Routing-only auth check. Runs before page rendering and must stay import-light:
 * it verifies tokens with `jose` only — never `pg`/db — so it stays safe to run
 * outside the app runtime. Data authorization always happens in the API layer,
 * which re-verifies strictly.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected =
    pathname === "/" || PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Not our concern — static assets and any other route pass through untouched.
  if (!isProtected && !isAuthPage) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const hasRefreshCookie = request.cookies.has(REFRESH_COOKIE);
  const accessStatus = accessToken ? await verifyAccessTokenStatus(accessToken) : "invalid";

  if (isProtected) {
    // valid   → normal pass-through.
    // expired → signed by us and of type access, but past exp: serve the shell;
    //           the client then silently refreshes (access cookies deliberately
    //           outlive their JWT for exactly this case).
    // refresh cookie present → pass through; the data APIs stay strict, so an
    //           unauthenticated visitor gains nothing but the page shell.
    if (accessStatus === "valid" || accessStatus === "expired" || hasRefreshCookie) {
      return NextResponse.next();
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth pages: bounce signed-in users to the workspace.
  if (accessStatus === "valid") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on app pages, but skip API routes, Next internals, and static files.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|css|js|map|txt|xml|woff2?)$).*)",
  ],
};
