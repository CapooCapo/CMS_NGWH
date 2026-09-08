import "server-only";
import { NextResponse } from "next/server";
import { errorFrom } from "./errors";

/** Keeps route failures opaque and consistently shaped. */
export async function routeHandler(
  context: string,
  handler: () => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  try {
    return await handler();
  } catch (error) {
    return errorFrom(error, context);
  }
}
