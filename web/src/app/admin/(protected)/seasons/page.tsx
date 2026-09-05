import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminPageHeader } from "@/components/admin/AdminShell";
import { Disclosure, JsonForm } from "@/components/admin/JsonForm";
import { Badge, EmptyState, ErrorState, Table, Td, Th } from "@/components/ui";
import { parsePage } from "@/lib/pagination";
import { listAdminSeasons } from "@/server/repositories/seasons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.seasons");
  return {
    title: t("metaTitle"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

/** REQ-TOURN-004 — seasons are what the public archive lists. */
export default async function AdminSeasonsPage({
  searchParams,
}: PageProps<"/admin/seasons">) {
  const [t, locale] = await Promise.all([
    getTranslations("admin.seasons"),
    getLocale(),
  ]);
  const statusOptions = [
    { value: "upcoming", label: t("statusUpcoming") },
    { value: "active", label: t("statusActive") },
    { value: "completed", label: t("statusCompleted") },
  ];
  const statusField = (defaultValue: string) => ({
    name: "status",
    label: t("status"),
    type: "select" as const,
    required: true,
    defaultValue,
    options: statusOptions,
  });
  const params = await searchParams;
  const page = parsePage(params.page);
  const rawSeason = Array.isArray(params.season) ? params.season[0] : params.season;
  const selectedSeasonId = rawSeason ? Number.parseInt(rawSeason, 10) : null;

  let seasons;
  try {
    seasons = await listAdminSeasons(page);
  } catch (error) {
    console.error("admin seasons", error);
    return (
      <>
        <AdminPageHeader title={t("title")} />
        <ErrorState title={t("databaseUnavailable")} />
      </>
    );
  }

  const hrefForSeason = (id: number) => {
    const query = new URLSearchParams();
    if (seasons.page > 1) query.set("page", String(seasons.page));
    if (selectedSeasonId !== id) query.set("season", String(id));
    const suffix = query.toString();
    return `/admin/seasons${suffix ? `?${suffix}` : ""}`;
  };

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
      />

      <div className="mb-6">
        <Disclosure label={t("add")}>
          <JsonForm
            action="/api/admin/seasons"
            submitLabel={t("create")}
            fields={[
              {
                type: "localizedPair",
                en: { name: "nameEn", label: t("nameEn"), required: true },
                vi: { name: "nameVi", label: t("nameVi"), required: true },
                colSpan: 2,
              },
              { name: "slug", label: t("slug"), required: true },
              statusField("upcoming"),
              { name: "startsOn", label: t("startsOn"), type: "date" },
              { name: "endsOn", label: t("endsOn"), type: "date" },
            ]}
          />
        </Disclosure>
      </div>

      {seasons.rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <>
          <Table
            caption={t("tableCaption")}
            minWidth="44rem"
            head={<><Th sticky>{t("season")}</Th><Th>{t("dates")}</Th><Th>{t("status")}</Th><Th align="right">{t("actions")}</Th></>}
          >
            {seasons.rows.map((season) => {
              const selected = selectedSeasonId === season.id;
              const statusLabel = season.status === "upcoming"
                ? t("statusUpcoming")
                : season.status === "active" ? t("statusActive") : t("statusCompleted");
              return (
                <Fragment key={season.id}>
                  <tr className={selected ? "bg-accent/10" : "hover:bg-surface-sunken"}>
                    <Td header sticky>
                      <span className="block">{locale === "vi" ? season.name_vi : season.name_en}</span>
                      <span className="block text-[length:var(--text-xs)] font-normal text-muted">/{season.slug}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{season.starts_on ?? "—"} {season.ends_on ? `→ ${season.ends_on}` : ""}</Td>
                    <Td><Badge tone={season.status === "active" ? "success" : "neutral"}>{statusLabel}</Badge></Td>
                    <Td align="right"><Link href={hrefForSeason(season.id)} aria-expanded={selected} className="text-[length:var(--text-sm)] font-semibold text-brand-text-text hover:underline">{selected ? t("closeEdit") : t("edit")}</Link></Td>
                  </tr>
                  {selected && (
                    <tr className="bg-surface-sunken/45"><Td colSpan={4}>
                      <JsonForm
                        action={`/api/admin/seasons/${season.id}`}
                        method="PATCH"
                        submitLabel={t("save")}
                        fields={[
                          { type: "localizedPair", en: { name: "nameEn", label: t("nameEn"), required: true, defaultValue: season.name_en }, vi: { name: "nameVi", label: t("nameVi"), required: true, defaultValue: season.name_vi }, colSpan: 2 },
                          { name: "slug", label: t("slug"), required: true, defaultValue: season.slug },
                          statusField(season.status),
                          { name: "startsOn", label: t("startsOn"), type: "date", defaultValue: season.starts_on },
                          { name: "endsOn", label: t("endsOn"), type: "date", defaultValue: season.ends_on },
                        ]}
                      />
                    </Td></tr>
                  )}
                </Fragment>
              );
            })}
          </Table>
          <AdminPagination basePath="/admin/seasons" pagination={seasons} searchParams={{}} />
        </>
      )}
    </>
  );
}
