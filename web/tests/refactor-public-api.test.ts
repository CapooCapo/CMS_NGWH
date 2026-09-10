import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as clubs from "@/server/repositories/clubs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("UI and JsonForm public barrels retain their established exports", () => {
  const uiSource = source("../src/components/ui/index.tsx");
  for (const name of [
    "ActionLink", "Badge", "Breadcrumbs", "Button", "ButtonLink", "Card",
    "Container", "Divider", "EmptyState", "ErrorState", "Eyebrow", "Field",
    "FormAlert", "LiveBadge", "PageHeader", "SectionHeading", "Skeleton",
    "SkeletonCards", "StatList", "Table", "Td", "Th", "buttonClass",
    "controlClass", "controlInvalidClass", "textareaClass",
  ]) assert.match(uiSource, new RegExp(`\\b${name}\\b`), `missing UI export ${name}`);
  const jsonForm = source("../src/components/admin/JsonForm.tsx");
  assert.match(jsonForm, /export \{ Disclosure \}/);
  assert.match(jsonForm, /export type \{ FieldSpec \}/);
});

test("repository facade retains its public runtime exports", () => {
  for (const name of [
    "cancelClubDeletionRequest", "clearClubHeadCoach", "createClub",
    "createClubMember", "deleteClubMember", "deleteRequestedClub",
    "findClubById", "findClubByOwnerAndId", "findClubByOwnerId",
    "findClubBySlug", "findClubMember", "listAdminClubs", "listClubMembers",
    "listClubs", "listProvinces", "requestClubDeletion", "setClubApproval",
    "setClubOwner", "updateClub", "updateClubMember",
  ]) assert.equal(typeof clubs[name as keyof typeof clubs], "function", `missing repository export ${name}`);
});
