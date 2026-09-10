import type { LocalizedPairSpec, LocalizedSingleSpec } from "./translationTypes";

export type FieldSpec =
  | { name: string; label: string; type?: "text" | "email" | "tel" | "url" | "number" | "date" | "datetime-local" | "password"; required?: boolean; defaultValue?: string | number | null; hint?: string; min?: number; max?: number; colSpan?: 1 | 2 }
  | { name: string; label: string; type: "textarea"; required?: boolean; defaultValue?: string | null; hint?: string; rows?: number; colSpan?: 1 | 2 }
  | { name: string; label: string; type: "select"; required?: boolean; defaultValue?: string | number | null; options: { value: string; label: string }[]; hint?: string; colSpan?: 1 | 2 }
  | { name: string; label: string; type: "checkbox"; defaultChecked?: boolean; hint?: string; colSpan?: 1 | 2 }
  | { name: string; label: string; type: "urlgroup"; keys: readonly { key: string; label: string }[]; defaultValue?: Record<string, string>; hint?: string; colSpan?: 1 | 2 }
  | LocalizedPairSpec
  | LocalizedSingleSpec;
