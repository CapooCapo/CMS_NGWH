import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  findClubOwnerByEmailWithHash,
  recordOwnerLogin,
} from "@/server/repositories/clubOwners";
import { verifyPassword } from "@/server/auth/password";
import {
  OWNER_SESSION_COOKIE,
  createOwnerSession,
  ownerSessionCookieOptions,
  purgeExpiredOwnerSessions,
} from "@/server/auth/ownerSession";
import { Validator, ValidationError, readJson } from "@/server/validation/validate";

/**
 * Club Owner login.
 *
 * Same anti-enumeration shape as the staff login (`/api/admin/login`): a
 * wrong email and a wrong password return the identical response and take the
 * same time (a dummy hash is checked when no account matched), so the
 * endpoint cannot be used to discover which emails have an account.
 *
 * Self-service signup creates accounts separately at `/api/owner/signup`.
 * This route remains the only place that establishes an owner session and
 * directs a successful login to the Clubs landing page.
 */
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const v = new Validator(body);
    const email = v.email("email", { required: true }) ?? "";
    const password = v.string("password", { required: true, max: 200 }) ?? "";
    v.assert();

    const owner = await findClubOwnerByEmailWithHash(email);
    const passwordOk = await verifyPassword(password, owner?.password_hash ?? DUMMY_HASH);

    if (!owner || !passwordOk || !owner.is_active) {
      return NextResponse.json({ error: "invalidCredentials" }, { status: 401 });
    }

    const { token, expiresAt } = await createOwnerSession(owner.id);
    await recordOwnerLogin(owner.id);
    void purgeExpiredOwnerSessions().catch(() => {});

    const store = await cookies();
    store.set(OWNER_SESSION_COOKIE, token, ownerSessionCookieOptions(expiresAt));

    return NextResponse.json({ owner: { id: owner.id, email: owner.email }, redirectTo: "/clubs" });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "validation", fields: error.errors },
        { status: 400 }
      );
    }
    console.error("owner login failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
