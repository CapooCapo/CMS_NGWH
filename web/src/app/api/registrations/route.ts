import { NextResponse } from "next/server";
import { createRegistration } from "@/server/repositories/registrations";
import {
  materializeDocuments,
  parseRegistration,
} from "@/server/validation/registration";
import { ValidationError } from "@/server/validation/validate";
import { currentOwner } from "@/server/auth/ownerSession";
import { findClubByOwnerId } from "@/server/repositories/clubs";

/**
 * REQ-REG-001/002/003 — club registration intake.
 *
 * **Authenticated.** A submission is the first half of "đăng nhập → đăng ký
 * CLB → duyệt → chủ CLB + HLV trưởng": approval later turns the submitter
 * into the club's owner and head coach, so the submitter has to be a known
 * account at intake time. An anonymous POST is a 401 — and that check lives
 * here, in the route, not only in the page that renders the form: the page
 * guard is a courtesy to the user, this is the security boundary.
 *
 * The identity is read from the session cookie via `currentOwner()`. Nothing
 * in the multipart body can influence it — `parseRegistration` does not even
 * look for an owner/user id field, so there is no `ownerId` a client could
 * send to register a club in someone else's name.
 *
 * Every field is still validated and uploads still pass a MIME allow-list
 * plus size/count caps before anything reaches the database.
 */
export async function POST(request: Request) {
  const owner = await currentOwner();
  if (!owner) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // An account may own only one club. This route-level check gives a stale
  // registration form a clear answer; approval repeats the invariant while
  // holding locks so this convenience check is never the only protection.
  if (await findClubByOwnerId(owner.id)) {
    return NextResponse.json({ error: "alreadyOwnsClub" }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "validation", fields: { _: "invalidBody" } },
      { status: 400 }
    );
  }

  try {
    const { input, pending } = parseRegistration(form);
    const documents = await materializeDocuments(pending);
    const registration = await createRegistration(
      // The session's account id, overriding anything the form carried.
      { ...input, clubOwnerId: owner.id },
      documents
    );
    return NextResponse.json(
      { id: registration.id, status: registration.status },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "validation", fields: error.errors },
        { status: 400 }
      );
    }
    // One pending registration per account (partial unique index in
    // migration 006) — a duplicate submit is the user's own earlier one, not
    // a server fault, so it gets a specific 409 the form can explain.
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "alreadyPending" }, { status: 409 });
    }
    // Logged server-side; the client gets no internal detail.
    console.error("registration submit failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
