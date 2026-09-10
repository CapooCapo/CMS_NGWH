import assert from "node:assert/strict";
import { test } from "node:test";
import { buildJsonFormPayload } from "../src/components/admin/jsonFormPayload";
import type { FieldSpec } from "../src/components/admin/fieldSpec";

test("JSON form payload preserves field names and normalizes each supported transport type", () => {
  const fields: FieldSpec[] = [
    { name: "name", label: "Name", required: true },
    { name: "year", label: "Year", type: "number" },
    { name: "active", label: "Active", type: "checkbox" },
    { name: "links", label: "Links", type: "urlgroup", keys: [{ key: "web", label: "Web" }, { key: "facebook", label: "Facebook" }] },
    { type: "localizedPair", en: { name: "nameEn", label: "English" }, vi: { name: "nameVi", label: "Vietnamese" } },
    { type: "localizedSingle", label: "Achievements", enName: "achievementsEn", viName: "achievementsVi", sourceLanguageLabel: "Source", englishLabel: "English", vietnameseLabel: "Vietnamese" },
  ];
  const form = new FormData();
  form.set("name", "  Tigers  ");
  form.set("year", " 2026 ");
  form.set("active", "on");
  form.set("links.web", " https://example.com ");
  form.set("links.facebook", " ");
  form.set("nameEn", " Tigers ");
  form.set("nameVi", " ");
  form.set("achievementsEn", "");
  form.set("achievementsVi", " Vô địch ");

  assert.deepEqual(buildJsonFormPayload(fields, form), {
    name: "Tigers",
    year: 2026,
    active: true,
    links: { web: "https://example.com" },
    nameEn: "Tigers",
    nameVi: null,
    achievementsEn: null,
    achievementsVi: "Vô địch",
  });
});

test("JSON form payload emits null for blank number fields and false for unchecked boxes", () => {
  const fields: FieldSpec[] = [{ name: "name", label: "Name" }, { name: "year", label: "Year", type: "number" }, { name: "active", label: "Active", type: "checkbox" }];
  assert.deepEqual(buildJsonFormPayload(fields, new FormData()), { name: null, year: null, active: false });
});

test("JSON serialization retains the previous invalid-number behavior", () => {
  const form = new FormData();
  form.set("year", "not-a-number");
  const payload = buildJsonFormPayload([{ name: "year", label: "Year", type: "number" }], form);
  assert.equal(Number.isNaN(payload.year), true);
  assert.deepEqual(JSON.parse(JSON.stringify(payload)), { year: null });
});
