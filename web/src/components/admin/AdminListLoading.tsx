import { getTranslations } from "next-intl/server";
import { Table, Td, Th } from "@/components/ui";

/** Route-level fallback that keeps the admin shell mounted during list loads. */
export async function AdminListLoading({ columns = 5 }: { columns?: number }) {
  const t = await getTranslations("admin.loading");
  const cells = Array.from({ length: columns }, (_, index) => index);
  return (
    <section aria-busy="true" aria-label={t("content")}>
      <p className="mb-5 h-8 w-48 animate-pulse rounded bg-surface-strong" aria-hidden="true" />
      <span className="sr-only">{t("content")}</span>
      <Table
        caption={t("table")}
        minWidth="44rem"
        head={cells.map((index) => <Th key={index}><span className="sr-only">{t("column")}</span></Th>)}
      >
        {Array.from({ length: 6 }, (_, row) => (
          <tr key={row}>
            {cells.map((cell) => <Td key={cell}><span className="block h-4 animate-pulse rounded bg-surface-strong" /></Td>)}
          </tr>
        ))}
      </Table>
    </section>
  );
}
