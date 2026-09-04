import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { matchLabels } from "@/components/home/LiveResults";
import { LiveScoreboard } from "@/components/matches/LiveScoreboard";
import { Container, ErrorState, PageHeader } from "@/components/ui";
import { absoluteUrl } from "@/lib/site";
import { getLiveAndResults } from "@/server/repositories/matches";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("live");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: { canonical: absoluteUrl("/live") },
    openGraph: {
      title: t("title"),
      description: t("metaDescription"),
      url: absoluteUrl("/live"),
    },
  };
}

/** Public scoreboard for REQ-HOME-005, server-rendered then synchronized by SSE. */
export default async function LivePage() {
  const [t, common, labels] = await Promise.all([
    getTranslations("live"),
    getTranslations("common"),
    matchLabels(),
  ]);

  let initial;
  try {
    const data = await getLiveAndResults(8);
    initial = { ...data, fetchedAt: new Date().toISOString() };
  } catch {
    return (
      <>
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("metaDescription")} />
        <Container className="py-10">
          <ErrorState title={common("error")} body={common("errorBody")} />
        </Container>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} lead={t("metaDescription")} />
      <Container className="py-10 sm:py-12">
        <LiveScoreboard initial={initial} labels={labels} />
      </Container>
    </>
  );
}
