import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/server/auth/password";

test("hashPassword produces a versioned scrypt string, never the plaintext", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.match(hash, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(!hash.includes("correct horse"));
});

test("the same password hashes differently each time (unique salt)", async () => {
  const a = await hashPassword("same-password-1234");
  const b = await hashPassword("same-password-1234");
  assert.notEqual(a, b);
  assert.ok(await verifyPassword("same-password-1234", a));
  assert.ok(await verifyPassword("same-password-1234", b));
});

test("verifyPassword accepts the right password and rejects wrong ones", async () => {
  const hash = await hashPassword("s3cret-password");
  assert.ok(await verifyPassword("s3cret-password", hash));
  assert.ok(!(await verifyPassword("s3cret-passwore", hash)));
  assert.ok(!(await verifyPassword("", hash)));
  assert.ok(!(await verifyPassword("S3CRET-PASSWORD", hash)));
});

test("verifyPassword returns false for malformed hashes instead of throwing", async () => {
  for (const bad of [
    "",
    "not-a-hash",
    "scrypt$1$2$3",
    "bcrypt$16384$8$1$AAAA$AAAA",
    "scrypt$abc$8$1$AAAA$AAAA",
    "scrypt$16384$8$1$AAAA$",
  ]) {
    assert.equal(await verifyPassword("anything", bad), false, `hash: ${bad}`);
  }
});
