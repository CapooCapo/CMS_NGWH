import { test } from "node:test";
import assert from "node:assert/strict";
import { Validator, ValidationError } from "../src/server/validation/validate";

test("required fields report `required` when missing, empty or whitespace", () => {
  for (const value of [undefined, null, "", "   "]) {
    const v = new Validator({ name: value });
    v.string("name", { required: true });
    assert.equal(v.errors.name, "required");
  }
});

test("strings are trimmed and length-bounded", () => {
  const v = new Validator({ a: "  hello  ", b: "x", c: "y".repeat(50) });
  assert.equal(v.string("a"), "hello");
  v.string("b", { min: 3 });
  assert.equal(v.errors.b, "tooShort");
  v.string("c", { max: 10 });
  assert.equal(v.errors.c, "tooLong");
});

test("email validation normalises case and rejects malformed addresses", () => {
  const good = new Validator({ e: "Person@Example.COM" });
  assert.equal(good.email("e"), "person@example.com");

  for (const bad of ["no-at", "a@b", "a@@b.com", "a b@c.com", "@example.com"]) {
    const v = new Validator({ e: bad });
    v.email("e");
    assert.equal(v.errors.e, "invalidEmail", `address: ${bad}`);
  }
});

test("url validation rejects non-http(s) schemes (XSS via href)", () => {
  for (const bad of [
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD4=",
    "file:///etc/passwd",
    "not a url",
  ]) {
    const v = new Validator({ u: bad });
    v.url("u");
    assert.equal(v.errors.u, "invalidUrl", `url: ${bad}`);
  }
  const ok = new Validator({ u: "https://example.com/path" });
  assert.equal(ok.url("u"), "https://example.com/path");
});

test("slug validation enforces the URL-safe shape", () => {
  const ok = new Validator({ s: "lotus-valley-titans" });
  assert.equal(ok.slug("s"), "lotus-valley-titans");
  for (const bad of ["Has Caps", "trailing-", "-leading", "double--hyphen", "spa ce", "sym!bol"]) {
    const v = new Validator({ s: bad });
    v.slug("s");
    assert.equal(v.errors.s, "invalidSlug", `slug: ${bad}`);
  }
});

test("integer validation rejects non-integers and out-of-range values", () => {
  const v = new Validator({ a: "12", b: "1.5", c: "abc", d: 500 });
  assert.equal(v.integer("a"), 12);
  v.integer("b");
  assert.equal(v.errors.b, "invalidNumber");
  v.integer("c");
  assert.equal(v.errors.c, "invalidNumber");
  v.integer("d", { max: 100 });
  assert.equal(v.errors.d, "outOfRange");
});

test("enum validation only accepts listed values", () => {
  const ok = new Validator({ s: "active" });
  assert.equal(ok.enum("s", ["upcoming", "active", "completed"] as const), "active");
  const bad = new Validator({ s: "deleted" });
  bad.enum("s", ["upcoming", "active", "completed"] as const);
  assert.equal(bad.errors.s, "invalidChoice");
});

test("only the first error per field is kept", () => {
  const v = new Validator({ a: "" });
  v.string("a", { required: true });
  v.email("a", { required: true });
  assert.equal(v.errors.a, "required");
});

test("assert() throws ValidationError carrying every field code", () => {
  const v = new Validator({ a: "", b: "nope" });
  v.string("a", { required: true });
  v.email("b", { required: true });
  assert.throws(
    () => v.assert(),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.deepEqual(error.errors, { a: "required", b: "invalidEmail" });
      return true;
    }
  );
});
