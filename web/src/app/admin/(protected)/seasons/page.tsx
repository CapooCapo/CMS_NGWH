import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Disclosure, JsonForm } from "@/components/admin/JsonForm";
import { Badge, Card, EmptyState, ErrorState } from "@/components/ui";
import { listSeasons } from "@/server/repositories/seasons";

export const metadata: Metadata = {
  title: "Seasons",
  robots: { index: false, follow: false },
};

const STATUS_FIELD = {
  name: "status",
  label: "Status",
  type: "select" as const,
  required: true,
  options: [
    { value: "upcoming", label: "Upcoming" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
  ],
};

/** REQ-TOURN-004 — seasons are what the public archive lists. */
export default async function AdminSeasonsPage() {
  let seasons;
  try {
    seasons = await listSeasons();
  } catch (error) {
    console.error("admin seasons", error);
    return (
      <>
        <AdminPageHeader title="Seasons" />
        <ErrorState title="Database unavailable" />
      </>
    );
  }

  return (
    <>
      <AdminPageHeader
        title="Seasons"
        description="Seasons group fixtures and drive the public tournament archive."
      />

      <div className="mb-6">
        <Disclosure label="Add a season">
          <JsonForm
            action="/api/admin/seasons"
            submitLabel="Create season"
            fields={[
              { name: "nameEn", label: "Name (EN)", required: true },
              { name: "nameVi", label: "Name (VI)", required: true },
              { name: "slug", label: "URL slug", required: true },
              { ...STATUS_FIELD, defaultValue: "upcoming" },
              { name: "startsOn", label: "Starts on", type: "date" },
              { name: "endsOn", label: "Ends on", type: "date" },
            ]}
          />
        </Disclosure>
      </div>

      {seasons.length === 0 ? (
        <EmptyState title="No seasons yet." />
      ) : (
        <ul className="flex flex-col gap-3">
          {seasons.map((season) => (
            <li key={season.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{season.name_en}</h2>
                      <Badge
                        tone={season.status === "active" ? "success" : "neutral"}
                      >
                        {season.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[length:var(--text-sm)] text-muted">
                      {season.name_vi} · /tournaments/{season.slug}
                      {season.starts_on ? ` · ${season.starts_on}` : ""}
                      {season.ends_on ? ` → ${season.ends_on}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Disclosure label="Edit">
                    <JsonForm
                      action={`/api/admin/seasons/${season.id}`}
                      method="PATCH"
                      submitLabel="Save season"
                      fields={[
                        { name: "nameEn", label: "Name (EN)", required: true, defaultValue: season.name_en },
                        { name: "nameVi", label: "Name (VI)", required: true, defaultValue: season.name_vi },
                        { name: "slug", label: "URL slug", required: true, defaultValue: season.slug },
                        { ...STATUS_FIELD, defaultValue: season.status },
                        { name: "startsOn", label: "Starts on", type: "date", defaultValue: season.starts_on },
                        { name: "endsOn", label: "Ends on", type: "date", defaultValue: season.ends_on },
                      ]}
                    />
                  </Disclosure>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
