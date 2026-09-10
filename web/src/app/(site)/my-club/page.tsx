import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Container, ErrorState } from "@/components/ui";
import { MyClubDashboard } from "@/components/owner/MyClubDashboard";
import { MyClubWorkflow } from "@/components/owner/MyClubWorkflow";
import { loadMyClubPageData } from "@/server/services/myClub";

export const metadata: Metadata = {
  title: "My Club",
  robots: { index: false, follow: false },
};

/** Server entry point: auth/data state is resolved below the route, while
 * presentation is composed from focused server components. */
export default async function MyClubPage() {
  const locale = await getLocale();
  let data;
  try {
    data = await loadMyClubPageData(locale);
  } catch {
    const myClub = await getTranslations("myClub");
    return <Container className="py-12"><ErrorState title={myClub("loadError")} /></Container>;
  }
  if (data.state === "anonymous") redirect("/login?next=%2Fmy-club");
  if (data.state !== "approved") return <MyClubWorkflow data={data} locale={locale} />;
  return <MyClubDashboard data={data} />;
}
