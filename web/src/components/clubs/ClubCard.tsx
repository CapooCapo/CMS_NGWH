import Link from "next/link";
import { ClubCrest } from "./ClubCrest";
import type { Club } from "@/server/repositories/types";
import { Card } from "@/components/ui";

/** Directory tile for one approved club (REQ-CLUB-001/004). */
export function ClubCard({
  club,
  labels,
  headingLevel = 3,
}: {
  club: Club;
  labels: { founded: string };
  /** 2 when the grid sits directly under the page `h1`; see NewsCard. */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Card
      as="article"
      variant="raised"
      // `min-w-0` so the card can shrink inside its grid track on very narrow
      // viewports instead of widening it past the viewport.
      className="group relative flex min-w-0 items-center gap-4 p-5"
    >
      <ClubCrest name={club.name} logoUrl={club.logo_url} size={56} />
      <div className="min-w-0 flex-1">
        <Heading className="truncate text-[length:var(--text-base)] font-bold">
          <Link
            href={`/clubs/${club.slug}`}
            className="transition-colors duration-[var(--motion-fast)] group-hover:text-brand-text-text"
          >
            {club.name}
            <span aria-hidden="true" className="absolute inset-0" />
          </Link>
        </Heading>
        <p className="mt-0.5 truncate text-[length:var(--text-sm)] text-muted">
          {club.province}
        </p>
        {club.founding_year && (
          <p className="eyebrow tabular mt-1.5 truncate text-muted">
            {labels.founded} {club.founding_year}
          </p>
        )}
      </div>
      <span
        aria-hidden="true"
        className="shrink-0 text-muted transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5 group-hover:text-brand-text-text"
      >
        →
      </span>
    </Card>
  );
}
