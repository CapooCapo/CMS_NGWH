import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { JsonForm } from "@/components/admin/JsonForm";
import { Card, Container, PageHeader, SectionHeading } from "@/components/ui";
import { currentOwner } from "@/server/auth/ownerSession";

export const metadata: Metadata = {
  title: "My Profile",
  robots: { index: false, follow: false },
};

/** The authenticated Club Owner account, deliberately separate from a club. */
export default async function ProfilePage() {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const t = await getTranslations("ownerWorkspace");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("profileTitle")} lead={t("profileLead")} />
      <Container width="narrow" className="py-10 sm:py-12">
        <Card className="p-6 sm:p-8">
          <SectionHeading>{t("accountDetails")}</SectionHeading>
          <dl className="mb-8 grid gap-4 border-b border-border pb-6 sm:grid-cols-2">
            <div>
              <dt className="eyebrow text-muted">{t("email")}</dt>
              <dd className="mt-1 break-all text-[length:var(--text-sm)] font-semibold">
                {owner.email}
              </dd>
            </div>
          </dl>
          <JsonForm
            action="/api/owner/profile"
            method="PATCH"
            submitLabel={t("saveProfile")}
            fields={[
              {
                name: "fullName",
                label: t("fullName"),
                required: true,
                defaultValue: owner.full_name,
              },
            ]}
          />
        </Card>
      </Container>
    </>
  );
}
