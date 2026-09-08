import { notFound, redirect } from "next/navigation";
import MyClubPage from "../../my-club/page";
import { currentOwner } from "@/server/auth/ownerSession";
import { findClubByOwnerAndId } from "@/server/repositories/clubs";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Reuses the established Club Owner dashboard after checking the requested
 * club id against the session owner. The legacy `/my-club` route remains a
 * compatibility alias, while every workspace card uses this scoped URL.
 */
export default async function MyClubDetailPage({ params }: PageProps) {
  const owner = await currentOwner();
  if (!owner) redirect("/login");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  if (!(await findClubByOwnerAndId(owner.id, id))) notFound();
  return <MyClubPage />;
}
