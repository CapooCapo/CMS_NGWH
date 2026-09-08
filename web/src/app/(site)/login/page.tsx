import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OwnerLoginForm } from "@/components/owner/OwnerLoginForm";
import { currentOwner } from "@/server/auth/ownerSession";

export const metadata: Metadata = {
  title: "Login",
  robots: { index: false, follow: false },
};

/**
 * Club Owner sign-in — the public-facing counterpart to `/admin/login`.
 * Staff keep using `/admin/login` unchanged; this route is exclusively for
 * the Club Owner account space (`club_owners` / `ngwh_owner_session`).
 */
export default async function LoginPage() {
  // `/clubs` is the Club Owner landing page after every successful login.
  if (await currentOwner()) redirect("/clubs");

  const t = await getTranslations("ownerLogin");

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-surface-sunken px-4 py-12">
      <OwnerLoginForm
        labels={{
          title: t("title"),
          subtitle: t("subtitle"),
          email: t("email"),
          password: t("password"),
          submit: t("submit"),
          submitting: t("submitting"),
          invalidCredentials: t("invalidCredentials"),
          rateLimited: t("rateLimited"),
          serverError: t("serverError"),
          noAccount: t("noAccount"),
          signUp: t("signUp"),
        }}
      />
    </div>
  );
}
