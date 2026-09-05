import assert from "node:assert/strict";
import { test } from "node:test";
import { filterHref, pageHref, parsePage, resolvePagination } from "../src/lib/pagination";

test("parsePage accepts one positive integer and safely falls back to page one", () => {
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage("3"), 3);
  assert.equal(parsePage(["4", "5"]), 4);
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-2"), 1);
  assert.equal(parsePage("not-a-page"), 1);
});

test("resolvePagination caps the page and calculates a ten-record range", () => {
  assert.deepEqual(resolvePagination(2, 37), {
    page: 2,
    pageSize: 10,
    total: 37,
    totalPages: 4,
    offset: 10,
    firstItem: 11,
    lastItem: 20,
  });
  assert.deepEqual(resolvePagination(99, 37), {
    page: 4,
    pageSize: 10,
    total: 37,
    totalPages: 4,
    offset: 30,
    firstItem: 31,
    lastItem: 37,
  });
  assert.equal(resolvePagination(5, 0).page, 1);
  assert.equal(resolvePagination(5, 0).firstItem, 0);
});

test("page links retain active filters while replacing an existing page", () => {
  assert.equal(
    pageHref("/admin/registrations", "page", 3, {
      status: "pending",
      page: "1",
      ignored: undefined,
    }),
    "/admin/registrations?status=pending&page=3"
  );
  assert.equal(
    filterHref("/admin/contact", { status: "new", page: "4" }),
    "/admin/contact?status=new",
    "a changed filter restarts at the implicit first page"
  );
});
