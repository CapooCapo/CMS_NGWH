import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  findByUsernameWithHash,
  recordLogin,
} from "@/server/repositories/adminUsers";
import { verifyPassword } from "@/server/auth/password";
import {
  SESSION_COOKIE,
  createSession,
  purgeExpiredSessions,
  sessionCookieOptions,
} from "@/server/auth/session";
import { Validator, ValidationError, readJson } from "@/server/validation/validate";
import {
  checkLoginLimit,
  clearSuccessfulLogin,
  clientIp,
  LoginRateLimitUnavailable,
  normalizedLoginAccount,
  recordFailedLogin,
} from "@/server/security/loginRateLimit";

/**
 * Staff login.
 *
 * Notes on the deliberate choices here:
 *  - a wrong username and a wrong password return the identical response, so
 *    the endpoint cannot be used to enumerate accounts;
 *  - the password hash is verified even when no user matched, using a dummy
 *    hash, so response time does not reveal whether the username exists;
 *  - deactivated accounts are rejected with the same generic message.
 *
 * There is no public sign-up counterpart: .ai/REQUIREMENTS.md contains no
 * user-account requirement, and accounts are provisioned by the CLI script
 * `npm run admin:create`.
 */
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const v = new Validator(body);
    v.only(["username", "password"]);
    const username = v.string("username", { required: true, max: 64 }) ?? "";
    const password = v.string("password", { required: true, max: 200 }) ?? "";
    v.assert();

    const ip = clientIp(request);
    const accountKey = normalizedLoginAccount(username);
    const existingLimit = await checkLoginLimit(ip, accountKey);
    if (existingLimit.locked) {
      return NextResponse.json(
        { error: "tooManyRequests" },
        { status: 429, headers: { "Retry-After": String(existingLimit.retryAfterSeconds) } }
      );
    }

    const user = await findByUsernameWithHash(username);
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

    if (!user || !ok || !user.is_active) {
      const limit = await recordFailedLogin(ip, accountKey);
      if (limit.locked) {
        return NextResponse.json(
          { error: "tooManyRequests" },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
        );
      }
      return NextResponse.json({ error: "invalidCredentials" }, { status: 401 });
    }

    await clearSuccessfulLogin(accountKey);
    const { token, expiresAt } = await createSession(user.id);
    await recordLogin(user.id);
    // Opportunistic housekeeping so expired rows do not pile up.
    void purgeExpiredSessions().catch(() => {});

    const store = await cookies();
    store.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

    return NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    if (error instanceof LoginRateLimitUnavailable) {
      return NextResponse.json({ error: "server" }, { status: 503 });
    }
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "validation", fields: error.errors },
        { status: 400 }
      );
    }
    console.error("admin login failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
