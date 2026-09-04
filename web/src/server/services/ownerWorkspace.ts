import "server-only";
import { currentOwner, type OwnerIdentity } from "@/server/auth/ownerSession";
import { findClubByOwnerId } from "@/server/repositories/clubs";
import { findLatestRegistrationForOwner } from "@/server/repositories/registrations";
import type { Club, ClubRegistration } from "@/server/repositories/types";

/**
 * "Where is this person in the club-registration workflow?" — resolved once,
 * server-side, from the session.
 *
 *   anonymous → signUp/logIn
 *   account, nothing submitted → may register
 *   submitted, awaiting review → pending
 *   reviewed and declined → rejected (may re-apply)
 *   approved (owns a club) → the My Club dashboard
 *
 * Three surfaces need exactly this answer and must never disagree: the
 * navigation, `/clubs/register` (which state of the form to show) and
 * `/my-club`. Computing it in one place is what keeps them consistent — and
 * every one of them derives it from the session cookie, never from a query
 * parameter.
 *
 * Owning a club outranks the registration row: an admin can attach an owner
 * to a club directly (no registration involved), and a club owner whose old
 * registration was somehow left `pending` should still see their club.
 */
export type OwnerWorkspace =
  | { state: "anonymous" }
  | { state: "noRegistration"; owner: OwnerIdentity }
  | { state: "pending"; owner: OwnerIdentity; registration: ClubRegistration }
  | { state: "rejected"; owner: OwnerIdentity; registration: ClubRegistration }
  | {
      state: "approved";
      owner: OwnerIdentity;
      club: Club;
      registration: ClubRegistration | null;
    };

export async function resolveOwnerWorkspace(): Promise<OwnerWorkspace> {
  const owner = await currentOwner();
  if (!owner) return { state: "anonymous" };

  const [club, registration] = await Promise.all([
    findClubByOwnerId(owner.id),
    findLatestRegistrationForOwner(owner.id),
  ]);

  if (club) return { state: "approved", owner, club, registration };
  if (registration?.status === "pending") return { state: "pending", owner, registration };
  if (registration?.status === "rejected") return { state: "rejected", owner, registration };

  // Includes the odd case of an `approved` registration whose club link was
  // later removed by an admin: there is nothing to manage, so the person is
  // back to being able to register.
  return { state: "noRegistration", owner };
}

/** The display name to show for an account, falling back to the email. */
export function ownerDisplayName(owner: OwnerIdentity): string {
  return owner.full_name?.trim() || owner.email;
}
