import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

/** Workspace routes that require a signed-in session. */
const PROTECTED_PREFIXES = ["/users", "/agent-board", "/ask-ai", "/watching"];

/** Auth pages a signed-in user has no business visiting. */
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  const isProtected =
    pathname === "/" || PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PAGES.includes(pathname) && hasSession) {
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
