import { NextResponse, type NextRequest } from "next/server";
// Imported from ./server/auth/cookie, not ./server/auth/session: the latter
// pulls in node:crypto and the pg driver, neither of which the Edge runtime can
// load, which would make every /admin request a 500 instead of a redirect.
import { SESSION_COOKIE } from "@/server/auth/cookie";
import { OWNER_SESSION_COOKIE } from "@/server/auth/ownerCookie";

/**
 * Gate for the `/admin` area and the Club Owner account area.
 *
 * This is a *navigation* guard only: it checks that a session cookie is
 * present and bounces to the relevant login page when it is not. It
 * deliberately does not validate the token — middleware runs on the edge
 * runtime where the Postgres driver is unavailable, and a cookie-presence
 * check is cheap.
 *
 * Real authorization happens in two places that middleware cannot replace:
 *  - every `/api/admin/*` / `/api/owner/*` handler calls `requireRole()` /
 *    `requireOwner()` (`requireOwnedClub()`), which resolves the session
 *    against the database;
 *  - Club Owner pages and every protected admin page re-resolve the session
 *    (`currentAdmin()` / `currentOwner()`) and redirect if it resolves to
 *    null (so a forged or expired cookie renders nothing).
 *
 * Being explicit about this matters: treating middleware as the security
 * boundary is the classic Next.js mistake. The two cookies are deliberately
 * distinct (staff vs Club Owner are different principals), so this function
 * picks the check and the login destination by which area was requested.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    // The login page is inside /admin but must stay reachable, otherwise an
    // unauthenticated visitor is redirected to it forever. This is checked
    // here rather than with a negative lookahead in `matcher`, because the
    // matcher is compiled by path-to-regexp and lookahead support there is
    // not dependable.
    if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
      return NextResponse.next();
    }
    if (request.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next();

    const loginUrl = new URL("/admin/login", request.url);
    if (pathname !== "/admin") loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Club Owner account pages.
  if (request.cookies.get(OWNER_SESSION_COOKIE)?.value) return NextResponse.next();
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/my-club/:path*", "/my-clubs/:path*", "/profile/:path*"],
};
