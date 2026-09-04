"use client";

import { useTranslations } from "next-intl";
import { Button, Container, ErrorState } from "@/components/ui";

/**
 * Route-level error boundary.
 *
 * Shows the generic localized message and a retry control; the underlying
 * error is left to the server logs rather than rendered, so an internal
 * message or stack never reaches a visitor.
 */
export default function RouteError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("common");
  return (
    <Container width="narrow" className="py-20 sm:py-24">
      <ErrorState
        title={t("error")}
        body={t("errorBody")}
        action={<Button onClick={reset}>{t("retry")}</Button>}
      />
    </Container>
  );
}
