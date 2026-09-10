import type { TranslationLocale } from "./translation";

export type LocalizedPairInputSpec = {
  name: string;
  label: string;
  type?: "text" | "textarea";
  required?: boolean;
  defaultValue?: string | null;
  hint?: string;
  rows?: number;
};

export type LocalizedPairSpec = {
  type: "localizedPair";
  en: LocalizedPairInputSpec;
  vi: LocalizedPairInputSpec;
  colSpan?: 1 | 2;
};

export type LocalizedSingleSpec = {
  type: "localizedSingle";
  label: string;
  enName: string;
  viName: string;
  defaultEn?: string | null;
  defaultVi?: string | null;
  hint?: string;
  rows?: number;
  colSpan?: 1 | 2;
  sourceLanguageLabel: string;
  englishLabel: string;
  vietnameseLabel: string;
};

export type LocalizedPairValues = Record<TranslationLocale, string>;
