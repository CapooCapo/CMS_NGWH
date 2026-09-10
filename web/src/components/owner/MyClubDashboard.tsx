import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui";
import type { ClubMembersLabels } from "@/components/admin/ClubMembersTable";
import type { ClubMemberPosition } from "@/lib/clubMembers";
import type { MyClubApprovedPageData } from "@/server/services/myClub";
import { MyClubDetails } from "./MyClubDetails";
import { MyClubMembers } from "./MyClubMembers";
import { MyClubSummary } from "./MyClubSummary";

export async function MyClubDashboard({ data }: { data: MyClubApprovedPageData }) {
  const [clubs, myClub] = await Promise.all([getTranslations("clubs"), getTranslations("myClub")]);
  const positionLabels: Record<ClubMemberPosition, string> = {
    PG: myClub("positionPG"), SG: myClub("positionSG"), SF: myClub("positionSF"), PF: myClub("positionPF"), C: myClub("positionC"),
    HEAD_COACH: myClub("staffRoleHeadCoach"), ASSISTANT_COACH: myClub("staffRoleAssistantCoach"), TEAM_MANAGER: myClub("staffRoleTeamManager"), TEAM_DOCTOR: myClub("staffRoleTeamDoctor"), PHYSIOTHERAPIST: myClub("staffRolePhysiotherapist"), STATISTICIAN: myClub("staffRoleStatistician"), INTERPRETER: myClub("staffRoleInterpreter"),
  };
  const memberLabels: ClubMembersLabels = {
    caption: myClub("navLabel"), number: myClub("tableNumber"), name: myClub("tableName"), role: myClub("tableRole"), position: myClub("tablePosition"), born: myClub("tableBorn"), actions: myClub("tableActions"), edit: myClub("tableEdit"), cancel: myClub("tableCancel"), delete: myClub("tableDelete"), deleteConfirmTemplate: myClub("tableDeleteConfirm", { name: "{name}" }), saveChanges: myClub("tableSave"), fullName: myClub("tableFullName"), roleLabels: { player: myClub("tablePlayer"), coach: myClub("tableCoach"), staff: myClub("tableStaff") }, positionLabels, headCoach: myClub("headCoachBadge"),
  };
  const labels = {
    eyebrow: myClub("eyebrow"), viewPublicPage: myClub("viewPublicPage"), deleteClub: myClub("deleteClub"), deleteClubBody: myClub("deleteClubBody"), deleteClubConfirmation: myClub("deleteClubConfirmation"), deleteClubCancel: myClub("deleteClubCancel"), deleteClubConfirm: myClub("deleteClubConfirm"), deleteClubUnavailable: myClub("deleteClubUnavailable"), deleteClubFailed: myClub("deleteClubFailed"), deleteClubRequested: myClub("deleteClubRequested"), cancelDeleteClubRequest: myClub("cancelDeleteClubRequest"), roleOwner: myClub("roleOwner"), roleHeadCoach: myClub("roleHeadCoach"), founded: clubs("founded"), clubInformation: myClub("clubInformation"), editClub: myClub("editClub"), saveChanges: myClub("saveChanges"), fieldName: myClub("fieldName"), fieldProvince: myClub("fieldProvince"), fieldFoundingYear: myClub("fieldFoundingYear"), fieldLogoUrl: myClub("fieldLogoUrl"), fieldWebsite: myClub("fieldWebsite"), fieldContactEmail: myClub("fieldContactEmail"), fieldContactPhone: myClub("fieldContactPhone"), fieldSocialLinks: myClub("fieldSocialLinks"), addAthlete: myClub("addAthlete"), addStaff: myClub("addStaff"), tableSave: myClub("tableSave"), documentPublic: myClub("documentPublic"), documentPrivate: myClub("documentPrivate"),
  };
  const clubLabels = { achievements: clubs("achievements"), noAchievements: clubs("noAchievements"), roster: clubs("roster"), noRoster: clubs("noRoster"), coachingStaff: clubs("coachingStaff"), noCoachingStaff: clubs("noCoachingStaff"), contactSocial: clubs("contactSocial"), contactInfo: clubs("contactInfo"), phone: clubs("phone"), website: clubs("website"), noContact: clubs("noContact"), social: clubs("social"), noSocial: clubs("noSocial"), documents: clubs("documents"), viewDocument: clubs("viewDocument"), noDocuments: clubs("noDocuments") };
  return <><MyClubSummary data={data} labels={labels} /><Container className="flex flex-col gap-10 py-10 sm:py-12"><MyClubDetails data={data} labels={labels} clubLabels={clubLabels} /><MyClubMembers data={data} labels={labels} clubLabels={clubLabels} memberLabels={memberLabels} /></Container></>;
}
