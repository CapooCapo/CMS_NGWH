import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_FILES,
  MAX_FILE_BYTES,
  parseRegistration,
  sanitizeFilename,
} from "../src/server/validation/registration";
import { ValidationError } from "../src/server/validation/validate";

/** Builds a FormData for the registration endpoint. */
function form(
  fields: Record<string, string>,
  files: { name: string; type: string; size: number }[] = []
): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  for (const file of files) {
    fd.append(
      "documents",
      new File([new Uint8Array(file.size)], file.name, { type: file.type })
    );
  }
  return fd;
}

const VALID = {
  clubName: "Lotus Valley Titans",
  operatingRegion: "Hanoi",
  representativeName: "Tran Bao Chau",
  representativeEmail: "rep@example.com",
  representativePhone: "+84 90 123 4567",
  notes: "Please review.",
};

test("a complete submission parses and normalises its fields", () => {
  const { input, pending } = parseRegistration(form(VALID));
  assert.equal(input.clubName, "Lotus Valley Titans");
  assert.equal(input.representativeEmail, "rep@example.com");
  assert.equal(pending.length, 0);
});

test("REQ-REG-002: the three required fields are enforced", () => {
  for (const field of ["clubName", "operatingRegion", "representativeName"]) {
    const fields = { ...VALID } as Record<string, string>;
    delete fields[field];
    assert.throws(
      () => parseRegistration(form(fields)),
      (error: unknown) => {
        assert.ok(error instanceof ValidationError);
        assert.equal(error.errors[field], "required");
        return true;
      }
    );
  }
});

test("a bad representative email is rejected", () => {
  assert.throws(
    () => parseRegistration(form({ ...VALID, representativeEmail: "nope" })),
    (error: unknown) =>
      error instanceof ValidationError &&
      error.errors.representativeEmail === "invalidEmail"
  );
});

test("REQ-REG-003 / OQ-011: uploads over the size cap are rejected", () => {
  assert.throws(
    () =>
      parseRegistration(
        form(VALID, [
          { name: "big.pdf", type: "application/pdf", size: MAX_FILE_BYTES + 1 },
        ])
      ),
    (error: unknown) =>
      error instanceof ValidationError && error.errors.documents === "fileTooLarge"
  );
});

test("REQ-REG-003 / OQ-011: disallowed MIME types are rejected", () => {
  for (const type of ["text/html", "image/svg+xml", "application/zip", "application/x-msdownload"]) {
    assert.throws(
      () => parseRegistration(form(VALID, [{ name: "x", type, size: 10 }])),
      (error: unknown) =>
        error instanceof ValidationError && error.errors.documents === "fileType",
      `type: ${type}`
    );
  }
});

test("every allow-listed type is accepted", () => {
  for (const type of ALLOWED_UPLOAD_TYPES) {
    const { pending } = parseRegistration(
      form(VALID, [{ name: "doc", type, size: 128 }])
    );
    assert.equal(pending.length, 1, `type: ${type}`);
  }
});

test("more than the file-count cap is rejected", () => {
  const files = Array.from({ length: MAX_FILES + 1 }, (_, i) => ({
    name: `f${i}.pdf`,
    type: "application/pdf",
    size: 100,
  }));
  assert.throws(
    () => parseRegistration(form(VALID, files)),
    (error: unknown) =>
      error instanceof ValidationError && error.errors.documents === "tooManyFiles"
  );
});

test("exactly the file-count cap is accepted", () => {
  const files = Array.from({ length: MAX_FILES }, (_, i) => ({
    name: `f${i}.pdf`,
    type: "application/pdf",
    size: 100,
  }));
  const { pending } = parseRegistration(form(VALID, files));
  assert.equal(pending.length, MAX_FILES);
});

test("sanitizeFilename strips paths, control characters and quotes", () => {
  assert.equal(sanitizeFilename("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFilename("C:\\Windows\\evil.pdf"), "evil.pdf");
  assert.equal(sanitizeFilename('re"port".xlsx'), "report.xlsx");
  // CR/LF are removed as control characters before whitespace is collapsed,
  // so they leave no gap behind — the point is that no newline survives into
  // the Content-Disposition header.
  assert.equal(sanitizeFilename("a\r\nb.pdf"), "ab.pdf");
  assert.equal(sanitizeFilename("a b.pdf"), "a b.pdf");
  assert.equal(sanitizeFilename(""), "upload");
  assert.equal(sanitizeFilename("/"), "upload");
  assert.ok(sanitizeFilename("x".repeat(400)).length <= 180);
});
