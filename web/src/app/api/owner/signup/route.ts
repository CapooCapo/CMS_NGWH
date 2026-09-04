import { NextResponse } from "next/server";
import { createClubOwnerAccount } from "@/server/repositories/clubOwners";
import { hashPassword } from "@/server/auth/password";
import { Validator, ValidationError, readJson } from "@/server/validation/validate";

/**
 * Self-service account signup — the entry point of the club-registration
 * workflow ("Đăng ký tài khoản").
 *
 * Creating an account grants **nothing**: the new row has no club and no
 * staff role, and there is no field in this request that could ask for
 * either. Ownership only ever arrives later, when an admin approves a club
 * registration this account submitted. That is why a public signup route is
 * safe here in a way a public "create club owner for club X" route would not
 * be.
 *
 * A successful signup deliberately does not establish an authenticated
 * session. Account creation and authentication are separate steps: the
 * client sends the person to `/login`, and only the login route creates a
 * session. This also means a new account cannot accidentally be treated as a
 * club owner before it has submitted and received approval for a registration.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const v = new Validator(body);
    const email = v.email("email", { required: true }) ?? "";
    const fullName = v.string("fullName", { required: true, min: 2, max: 160 }) ?? "";
    // Same 10-character floor as staff accounts and admin-created owners.
    const password = v.string("password", { required: true, min: 10, max: 200 }) ?? "";
    v.assert();

    const result = await createClubOwnerAccount({
      email,
      fullName,
      passwordHash: await hashPassword(password),
    });

    if (!result.ok) {
      // Reported against the field so the form can render it inline. This
      // does disclose that an address is registered — unavoidable for a
      // signup form, and the *login* route stays non-enumerable.
      return NextResponse.json(
        { error: "validation", fields: { email: "duplicate" } },
        { status: 409 }
      );
    }

    return NextResponse.json({ owner: result.owner, redirectTo: "/login" }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "validation", fields: error.errors },
        { status: 400 }
      );
    }
    console.error("owner signup failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
