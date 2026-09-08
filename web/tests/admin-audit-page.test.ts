import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { formatDateTime } from "../src/lib/format";

const root = new URL("../", import.meta.url);

function source(path: string): string {
  return readFileSync(new URL(path, root), "utf8");
}

test("audit history page and navigation use the protected read-only route", () => {
  const page = source("src/app/admin/(protected)/audit-logs/page.tsx");
  const nav = source("src/components/admin/AdminNav.tsx");
  assert.match(page, /listAdminAuditLogs/);
  assert.match(page, /isPrivileged\(admin\.role\)/);
  assert.match(page, /formatDateTime\(log\.createdAt, locale\)/);
  assert.doesNotMatch(page, /(?:JsonForm|ToggleButton|fetch\()/);
  assert.match(nav, /href: "\/admin\/audit-logs", labelKey: "auditLogs", roles: \[\]/);
});

test("audit timestamps are formatted as a localized date and time, never Invalid Date", () => {
  const formatted = formatDateTime("2026-09-08T03:25:32.000Z", "vi");
  assert.ok(formatted);
  assert.notEqual(formatted, "Invalid Date");
  assert.match(formatted, /2026/);
});

test("audit page and navigation translations exist in every locale", () => {
  for (const locale of ["en", "vi"]) {
    const messages = JSON.parse(source(`messages/${locale}.json`)) as {
      admin?: { meta?: Record<string, string>; nav?: Record<string, string>; auditLogs?: Record<string, string> };
    };
    assert.equal(typeof messages.admin?.meta?.auditLogs, "string");
    assert.equal(typeof messages.admin?.nav?.auditLogs, "string");
    for (const key of ["title", "description", "tableCaption", "time", "actor", "action", "resource", "resourceId", "ip", "metadata"]) {
      assert.equal(typeof messages.admin?.auditLogs?.[key], "string", `${locale} missing auditLogs.${key}`);
    }
  }
});
