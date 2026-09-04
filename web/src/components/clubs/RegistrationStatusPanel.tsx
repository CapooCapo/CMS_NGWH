import { Badge, ButtonLink, Card } from "@/components/ui";
import type { ClubRegistration } from "@/server/repositories/types";

/**
 * The state of one person's club registration, rendered the same way on
 * `/clubs/register` and `/my-club` so the two pages can never appear to
 * disagree about where someone is in the workflow.
 *
 * Presentation only — every state here is decided server-side by
 * `resolveOwnerWorkspace()`.
 */
export function RegistrationStatusPanel({
  status,
  registration,
  labels,
  locale,
  action,
}: {
  status: "pending" | "approved" | "rejected";
  registration: ClubRegistration | null;
  labels: {
    title: string;
    body: string;
    badge: string;
    reason: string;
    submittedOn: string;
    club: string;
  };
  locale: string;
  action?: React.ReactNode;
}) {
  // `muted` (not a red badge) for rejected: DESIGN_SYSTEM.md calls out
  // near-identical reds as a past mistake, and the reason text below already
  // carries the negative meaning.
  const tone = status === "approved" ? "success" : status === "rejected" ? "muted" : "warning";

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge tone={tone}>{labels.badge}</Badge>
          <h2 className="mt-3 font-display text-[length:var(--text-xl)] font-bold">
            {labels.title}
          </h2>
          <p className="mt-2 max-w-[58ch] text-[length:var(--text-sm)] text-muted">
            {labels.body}
          </p>
        </div>
        {action}
      </div>

      {registration && (
        <dl className="mt-6 flex flex-col gap-2 border-t border-border pt-5 text-[length:var(--text-sm)]">
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="text-muted">{`${labels.submittedOn}:`}</dt>
            <dd className="font-semibold">
              {new Date(registration.created_at).toLocaleDateString(locale)}
            </dd>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <dt className="text-muted">{`${labels.club}:`}</dt>
            <dd className="font-semibold">{registration.club_name}</dd>
          </div>
          {/* A rejection without a stated reason is worse than useless, so
              the row only appears when the reviewer actually wrote one. */}
          {status === "rejected" && registration.review_note && (
            <div className="flex flex-wrap items-baseline gap-2">
              <dt className="text-muted">{`${labels.reason}:`}</dt>
              <dd className="max-w-[58ch] whitespace-pre-line">{registration.review_note}</dd>
            </div>
          )}
        </dl>
      )}
    </Card>
  );
}

/** The signed-out state of the registration page: explain, then offer both doors. */
export function RegistrationAuthGate({
  labels,
}: {
  labels: {
    title: string;
    body: string;
    signIn: string;
    createAccount: string;
    next: string;
  };
}) {
  const query = `?next=${encodeURIComponent(labels.next)}`;
  return (
    <div className="flex flex-col items-center gap-5 rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface-sunken/60 px-6 py-12 text-center">
      <div>
        <p className="font-display text-[length:var(--text-lg)] font-bold">{labels.title}</p>
        <p className="mt-2 max-w-[46ch] text-[length:var(--text-sm)] text-muted">{labels.body}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href={`/login${query}`}>{labels.signIn}</ButtonLink>
        <ButtonLink href={`/signup${query}`} tone="outline">
          {labels.createAccount}
        </ButtonLink>
      </div>
    </div>
  );
}
