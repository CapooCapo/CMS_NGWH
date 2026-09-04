import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClass, controlClass } from "@/components/ui";

/**
 * REQ-CLUB-002 — province filter, plus name search.
 *
 * Implemented as a plain GET form rather than client-side state: each filtered
 * view is then a real, shareable, crawlable URL and the control works with
 * JavaScript disabled. `province` is a `<select>` whose options come from the
 * database, so an arbitrary value cannot be injected through the UI (the
 * server also treats it as an untrusted parameter regardless).
 */
export async function ClubFilters({
  provinces,
  search,
  province,
}: {
  provinces: readonly string[];
  search: string;
  province: string;
}) {
  const [t, common] = await Promise.all([
    getTranslations("clubs"),
    getTranslations("common"),
  ]);

  return (
    <form
      method="get"
      action="/clubs"
      className="mb-8 grid gap-4 rounded-[var(--radius-sm)] border border-border bg-surface-sunken p-4 sm:grid-cols-[1fr_16rem_auto] sm:items-end"
    >
      <div className="min-w-0">
        <label
          htmlFor="club-search"
          className="mb-1.5 block text-[length:var(--text-sm)] font-semibold"
        >
          {t("searchLabel")}
        </label>
        <input
          id="club-search"
          name="q"
          type="search"
          defaultValue={search}
          placeholder={t("searchPlaceholder")}
          className={controlClass}
        />
      </div>
      <div className="min-w-0">
        <label
          htmlFor="club-province"
          className="mb-1.5 block text-[length:var(--text-sm)] font-semibold"
        >
          {t("province")}
        </label>
        <select
          id="club-province"
          name="province"
          defaultValue={province}
          className={controlClass}
        >
          <option value="">{t("allProvinces")}</option>
          {provinces.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className={buttonClass("primary")}>
          {common("filter")}
        </button>
        {(search || province) && (
          <Link href="/clubs" className={buttonClass("ghost")}>
            {common("clear")}
          </Link>
        )}
      </div>
    </form>
  );
}
