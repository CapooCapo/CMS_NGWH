import "server-only";
import { badRequest, ok, translationUnavailable } from "@/server/api/respond";
import { requireRole, type Guarded } from "@/server/auth/guard";
import { translateWithMyMemory } from "@/server/services/myMemoryTranslation";
import {
  parseAdminTranslation,
  type AdminTranslationInput,
} from "@/server/validation/adminTranslation";
import { readJson, ValidationError } from "@/server/validation/validate";

type RequireRole = () => Promise<Guarded>;
type Translate = (input: AdminTranslationInput) => Promise<string>;

/** Dependency overrides make the HTTP behavior testable without a session or provider. */
export type AdminTranslationHandlerDependencies = {
  requireRole?: RequireRole;
  translate?: Translate;
};

export async function handleAdminTranslation(
  request: Request,
  dependencies: AdminTranslationHandlerDependencies = {}
) {
  const guard = await (dependencies.requireRole ?? requireRole)();
  if (!guard.ok) return guard.response;

  let input: AdminTranslationInput;
  try {
    input = parseAdminTranslation(await readJson(request));
  } catch (error) {
    if (error instanceof ValidationError) return badRequest(error.errors);
    throw error;
  }

  try {
    const translation = await (dependencies.translate ?? translateWithMyMemory)(input);
    return ok({ translation });
  } catch {
    // Do not use fail(): provider errors can retain a URL containing q/key.
    return translationUnavailable();
  }
}
