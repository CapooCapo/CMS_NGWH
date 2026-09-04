import "server-only";
import { Validator, ValidationError, type FieldErrors } from "./validate";
import type {
  RegistrationInput,
  UploadedDocument,
} from "@/server/repositories/registrations";

/**
 * REQ-REG-002 — the standardized registration form: club name, operating
 * region and representative details.
 *
 * REQ-REG-003 — uploads. OQ-011 (format and size limits) is Open, so the
 * limits below are documented conservative defaults rather than a requirement.
 * They live in one place so answering OQ-011 is a one-line change.
 */
export const MAX_FILES = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Allow-list, not a block-list: anything not named here is rejected. */
export const ALLOWED_UPLOAD_TYPES: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/**
 * Strips any directory component, control characters and quotes from a
 * client-supplied filename. The value is stored and later echoed in a
 * Content-Disposition header, so path separators, CR/LF and quotes must go —
 * otherwise a crafted filename could traverse paths or inject a header.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  return (
    base
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .replace(/["]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180) || "upload"
  );
}

/** An upload that still carries its `File` handle, before the body is read. */
export type PendingDocument = {
  filename: string;
  contentType: string;
  file: File;
};

export function parseRegistration(form: FormData): {
  input: RegistrationInput;
  pending: PendingDocument[];
} {
  const data: Record<string, unknown> = {};
  for (const key of [
    "clubName",
    "operatingRegion",
    "representativeName",
    "representativeEmail",
    "representativePhone",
    "notes",
  ]) {
    const value = form.get(key);
    if (typeof value === "string") data[key] = value;
  }

  const v = new Validator(data);
  const input: RegistrationInput = {
    // Never parsed from the form — the route overwrites this with the
    // authenticated session's account id. Present only so the object matches
    // `RegistrationInput`; see the route's comment.
    clubOwnerId: null,
    clubName: v.string("clubName", { required: true, min: 2, max: 200 }) ?? "",
    operatingRegion:
      v.string("operatingRegion", { required: true, min: 2, max: 160 }) ?? "",
    representativeName:
      v.string("representativeName", { required: true, min: 2, max: 160 }) ?? "",
    representativeEmail: v.email("representativeEmail", { required: true }) ?? "",
    representativePhone: v.phone("representativePhone"),
    notes: v.string("notes", { max: 4000 }),
  };

  // REQ-REG-003 uploads.
  const files = form
    .getAll("documents")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const fileErrors: FieldErrors = {};
  if (files.length > MAX_FILES) {
    fileErrors.documents = "tooManyFiles";
  } else {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        fileErrors.documents = "fileTooLarge";
        break;
      }
      if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
        fileErrors.documents = "fileType";
        break;
      }
    }
  }

  const errors = { ...v.errors, ...fileErrors };
  if (Object.keys(errors).length > 0) throw new ValidationError(errors);

  return {
    input,
    pending: files.map((file) => ({
      filename: sanitizeFilename(file.name),
      contentType: file.type,
      file,
    })),
  };
}

/** Reads the file bodies once validation has passed. */
export async function materializeDocuments(
  pending: readonly PendingDocument[]
): Promise<UploadedDocument[]> {
  return Promise.all(
    pending.map(async (doc) => ({
      filename: doc.filename,
      contentType: doc.contentType,
      bytes: Buffer.from(await doc.file.arrayBuffer()),
    }))
  );
}
