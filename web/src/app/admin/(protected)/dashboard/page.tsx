import Link from "next/link";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminPageHeader, AdminSection } from "@/components/admin/AdminShell";
import { Badge, Card, ErrorState } from "@/components/ui";
import { countAdminUsers } from "@/server/repositories/adminUsers";
import { listClubs } from "@/server/repositories/clubs";
import { countNewContactMessages } from "@/server/repositories/contact";
import { getLiveAndResults } from "@/server/repositories/matches";
import { countRegistrationsByStatus } from "@/server/repositories/registrations";
import { listSeasons } from "@/server/repositories/seasons";

export async function generateMetadata(): Promise<Metadata> {
  const [metaT, t] = await Promise.all([
    getTranslations("admin.meta"),
    getTranslations("admin.dashboard"),
  ]);
  return {
    title: metaT("dashboard"),
    description: t("description"),
    robots: { index: false, follow: false },
  };
}

/** Live counts straight from the database — no cached or mocked figures. */
export default async function AdminDashboard() {
  const [t, statusT] = await Promise.all([
    getTranslations("admin.dashboard"),
    getTranslations("admin.status"),
  ]);
  let data;
  try {
    const [registrations, clubs, approved, seasons, live, contact, users] =
      await Promise.all([
        countRegistrationsByStatus(),
        listClubs({ approvedOnly: false, limit: 1 }),
        listClubs({ approvedOnly: true, limit: 1 }),
        listSeasons(),
        getLiveAndResults(3),
        countNewContactMessages(),
        countAdminUsers(),
      ]);
    data = { registrations, clubs, approved, seasons, live, contact, users };
  } catch (error) {
    console.error("admin dashboard", error);
    return (
      <>
        <AdminPageHeader title={t("title")} />
        <ErrorState
          title={t("databaseUnavailable")}
          body={t("databaseUnavailableBody")}
        />
      </>
    );
  }

  /*
   * Attention-first: anything with a pending count is surfaced as an action
   * row above the plain counters, so the operator sees what needs doing before
   * reading figures that are merely informational.
   */
  const actions = [
    {
      label: t("pendingRegistrations"),
      value: data.registrations.pending,
      href: "/admin/registrations?status=pending",
      tone: "warning" as const,
    },
    {
      label: t("newContactMessages"),
      value: data.contact,
      href: "/admin/contact?status=new",
      tone: "warning" as const,
    },
    {
      label: t("liveMatches"),
      value: data.live.live.length,
      href: "/admin/matches",
      tone: "live" as const,
    },
  ].filter((item) => item.value > 0);

  const counters = [
    {
      label: t("clubsPublished"),
      value: `${data.approved.total} / ${data.clubs.total}`,
      href: "/admin/clubs",
    },
    {
      label: t("registrationsApproved"),
      value: data.registrations.approved,
      href: "/admin/registrations?status=approved",
    },
    { label: t("seasons"), value: data.seasons.length, href: "/admin/seasons" },
    { label: t("staffAccounts"), value: data.users, href: "/admin/users" },
  ];

  return (
    <>
      <AdminPageHeader
        title={t("title")}
        description={t("description")}
      />

      {actions.length > 0 && (
        <AdminSection title={t("needsAttention")}>
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[var(--shadow-xs)]">
            {actions.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-4 px-5 py-4 transition-colors duration-[var(--motion-fast)] hover:bg-surface-sunken/60"
                >
                  <span className="font-display tabular w-12 shrink-0 text-[length:var(--text-2xl)] font-black leading-none">
                    {item.value}
                  </span>
                  <span className="min-w-0 flex-1 text-[length:var(--text-sm)] font-semibold">
                    {item.label}
                  </span>
                  <Badge tone={item.tone}>
                    {item.tone === "live" ? statusT("live") : t("action")}
                  </Badge>
                  <span aria-hidden="true" className="shrink-0 text-muted">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </AdminSection>
      )}

      <AdminSection title={t("atAGlance")}>
        <ul className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {counters.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex h-full flex-col justify-between gap-3.5 rounded-[var(--radius-lg)] border border-border bg-surface p-5 shadow-[var(--shadow-xs)] transition-all duration-[var(--motion-base)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-md)]"
              >
                <span className="eyebrow text-muted">{item.label}</span>
                <span className="font-display tabular text-[length:var(--text-2xl)] font-black leading-none">
                  {item.value}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </AdminSection>

      <Card className="bg-surface-sunken/50 p-6">
        <h2 className="eyebrow mb-2 text-muted">{t("contentSources")}</h2>
        <p className="max-w-[72ch] text-[length:var(--text-sm)] leading-relaxed text-muted">
          {t("contentSourcesBody")}
        </p>
      </Card>
    </>
  );
}
