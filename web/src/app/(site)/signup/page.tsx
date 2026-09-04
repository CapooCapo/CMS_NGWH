import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OwnerSignupForm } from "@/components/owner/OwnerSignupForm";
import { currentOwner } from "@/server/auth/ownerSession";

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

/**
 * Account signup ("Đăng ký tài khoản") — step one of the club-registration
 * workflow. It creates an account only; authentication always happens next on
 * `/login`, rather than silently creating a session or registration.
 */
export default async function SignupPage() {
  // Already signed in: there is nothing to sign up for.
  if (await currentOwner()) redirect("/clubs");

  const t = await getTranslations("ownerSignup");

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-surface-sunken px-4 py-12">
      <OwnerSignupForm
        labels={{
          title: t("title"),
          subtitle: t("subtitle"),
          fullName: t("fullName"),
          email: t("email"),
          password: t("password"),
          confirmPassword: t("confirmPassword"),
          passwordHint: t("passwordHint"),
          nameTooShort: t("nameTooShort"),
          passwordTooShort: t("passwordTooShort"),
          passwordMismatch: t("passwordMismatch"),
          submit: t("submit"),
          submitting: t("submitting"),
          emailTaken: t("emailTaken"),
          serverError: t("serverError"),
          haveAccount: t("haveAccount"),
          signIn: t("signIn"),
        }}
      />
    </div>
  );
}
