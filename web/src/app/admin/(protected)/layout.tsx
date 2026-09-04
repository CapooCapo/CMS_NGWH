import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { currentAdmin } from "@/server/auth/session";

/**
 * Authorization boundary for the authenticated admin pages.
 *
 * The pages live in a `(protected)` route group so this layout does NOT wrap
 * `/admin/login`. Next layouts nest rather than override, so a layout at
 * `app/admin/layout.tsx` would also wrap the login page and redirect it to
 * itself forever. The route group keeps the URLs unchanged (`/admin/dashboard`
 * etc.) while leaving login outside the guard.
 *
 * This resolves the session against the database, unlike the middleware, which
 * only checks that a cookie is present. A forged, expired or deactivated
 * session therefore renders nothing and is redirected here — middleware is a
 * convenience, this is the real gate for pages.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await currentAdmin();
  if (!admin) redirect("/admin/login");
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
