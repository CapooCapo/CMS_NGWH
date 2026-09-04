import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { resolveLocale } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = resolveLocale(cookieStore.get("NEXT_LOCALE")?.value);
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages };
});
