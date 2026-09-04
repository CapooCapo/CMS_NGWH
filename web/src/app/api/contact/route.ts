import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/i18n/config";
import { createContactMessage } from "@/server/repositories/contact";
import {
  ValidationError,
  Validator,
  readJson,
} from "@/server/validation/validate";

/**
 * REQ-CONTACT-002 — contact / feedback submissions.
 *
 * OQ-014 (which fields, and where submissions are routed) is Open. This
 * endpoint therefore only *persists* the message for the admin inbox; nothing
 * is emailed or forwarded, because no destination has been decided. The field
 * set is the conventional minimum and is recorded as an assumption rather than
 * presented as a requirement.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const v = new Validator(body);
    const input = {
      name: v.string("name", { required: true, min: 2, max: 160 }) ?? "",
      email: v.email("email", { required: true }) ?? "",
      subject: v.string("subject", { max: 200 }),
      message: v.string("message", { required: true, min: 10, max: 5000 }) ?? "",
      locale: v.enum("locale", SUPPORTED_LOCALES) ?? DEFAULT_LOCALE,
    };
    v.assert();

    const message = await createContactMessage(input);
    return NextResponse.json({ id: message?.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: "validation", fields: error.errors },
        { status: 400 }
      );
    }
    console.error("contact submit failed", error);
    return NextResponse.json({ error: "server" }, { status: 500 });
  }
}
