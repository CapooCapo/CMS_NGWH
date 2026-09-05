import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/admin/LoginForm";
import { currentAdmin } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const [metaT, t] = await Promise.all([
    getTranslations("admin.meta"),
    getTranslations("admin.login"),
  ]);
  return {
    title: metaT("login"),
    description: t("subtitle"),
    // Never index the login page.
    robots: { index: false, follow: false },
  };
}

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  // Already signed in — skip the form.
  if (await currentAdmin()) redirect("/admin/dashboard");

  const params = await searchParams;
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  // Only accept a same-site absolute path, so `?next=` cannot be used as an
  // open redirect to another origin.
  const next =
    raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin/dashboard";

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-sunken px-4 py-12">
      <LoginForm next={next} />
    </div>
  );
}
