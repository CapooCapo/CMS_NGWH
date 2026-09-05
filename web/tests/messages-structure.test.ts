import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

type MessageValue = string | { [key: string]: MessageValue };

function readMessages(name: "en" | "vi"): MessageValue {
  return JSON.parse(
    readFileSync(new URL(`../messages/${name}.json`, import.meta.url), "utf8")
  ) as MessageValue;
}

function structure(value: MessageValue): unknown {
  if (typeof value === "string") return "string";

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, structure(child)])
  );
}

test("English and Vietnamese message files have identical key structures", () => {
  assert.deepEqual(structure(readMessages("en")), structure(readMessages("vi")));
});
