import { getTranslations } from "next-intl/server";
import { ButtonLink, Container, EmptyState, PageHeader } from "@/components/ui";
import { RegistrationStatusPanel } from "@/components/clubs/RegistrationStatusPanel";
import type { MyClubPageData } from "@/server/services/myClub";

export async function MyClubWorkflow({ data, locale }: { data: Exclude<MyClubPageData, { state: "approved" }>; locale: string }) {
  const [myClub, register] = await Promise.all([getTranslations("myClub"), getTranslations("register")]);
  const registerCta = <ButtonLink href="/clubs/register">{myClub("registerClub")}</ButtonLink>;
  return <><PageHeader eyebrow={myClub("eyebrow")} title={myClub("title")} /><Container width="narrow" className="py-10 sm:py-12">
    {data.state === "noRegistration" && <EmptyState title={myClub("noRegistrationTitle")} body={myClub("noRegistrationBody")} action={registerCta} />}
    {data.state === "pending" && <RegistrationStatusPanel status="pending" registration={data.registration} labels={{ title: myClub("pendingTitle"), body: myClub("pendingBody"), badge: register("statusPendingBadge"), reason: register("statusReason"), submittedOn: register("submittedOn"), club: register("statusClub") }} locale={locale} />}
    {data.state === "rejected" && <RegistrationStatusPanel status="rejected" registration={data.registration} labels={{ title: myClub("rejectedTitle"), body: myClub("rejectedBody"), badge: register("statusRejectedBadge"), reason: register("statusReason"), submittedOn: register("submittedOn"), club: register("statusClub") }} locale={locale} action={registerCta} />}
  </Container></>;
}
