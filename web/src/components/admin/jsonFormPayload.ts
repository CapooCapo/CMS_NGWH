import type { FieldSpec } from "./fieldSpec";

const normalized = (value: FormDataEntryValue | null) => typeof value === "string" && value.trim() !== "" ? value.trim() : null;

/** Converts the declarative form fields into the existing JSON API payload. */
export function buildJsonFormPayload(fields: readonly FieldSpec[], form: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === "localizedPair") {
      for (const localizedField of [field.en, field.vi]) payload[localizedField.name] = normalized(form.get(localizedField.name));
      continue;
    }
    if (field.type === "localizedSingle") {
      for (const name of [field.enName, field.viName]) payload[name] = normalized(form.get(name));
      continue;
    }
    if (field.type === "urlgroup") {
      const group: Record<string, string> = {};
      for (const { key } of field.keys) {
        const value = normalized(form.get(`${field.name}.${key}`));
        if (value) group[key] = value;
      }
      payload[field.name] = group;
      continue;
    }
    const value = normalized(form.get(field.name));
    payload[field.name] = field.type === "checkbox" ? form.get(field.name) === "on" : field.type === "number" && value !== null ? Number(value) : value;
  }
  return payload;
}
