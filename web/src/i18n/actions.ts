"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DEFAULT_LOCALE, resolveLocale } from "./config";

export async function setLocaleAction(locale: string) {
  const safeLocale = resolveLocale(locale) ?? DEFAULT_LOCALE;
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", safeLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/");
}
