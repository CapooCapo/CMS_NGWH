import { getTranslations } from "next-intl/server";
import { ButtonLink, Container, Eyebrow } from "@/components/ui";

/**
 * Body of the 404 page, without any page chrome.
 *
 * Shared by two boundaries: `(site)/not-found.tsx`, which renders inside the
 * public layout that already provides `<main>`, and the root
 * `not-found.tsx`, which handles URLs outside the `(site)` group and therefore
 * supplies the chrome itself. Keeping the content here is what stops the two
 * from drifting — or from nesting two `<main>` landmarks.
 */
export async function NotFoundContent() {
  const [common, nav] = await Promise.all([
    getTranslations("common"),
    getTranslations("nav"),
  ]);
  return (
    <Container width="narrow" className="py-20 sm:py-28">
      <div className="max-w-[42ch]">
        <Eyebrow className="mb-4">{common("notFound")}</Eyebrow>
        <p
          aria-hidden="true"
          className="font-display tabular text-[clamp(4rem,14vw,8rem)] font-black leading-[0.85] text-brand"
        >
          404
        </p>
        <h1 className="mt-5 text-[length:var(--text-2xl)] font-extrabold leading-tight">
          {common("notFoundTitle")}
        </h1>
        <p className="mt-3 text-[length:var(--text-base)] leading-relaxed text-muted">
          {common("notFoundBody")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/">{nav("home")}</ButtonLink>
          <ButtonLink href="/tournaments" tone="outline">
            {nav("tournaments")}
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
