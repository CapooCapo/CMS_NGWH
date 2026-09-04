import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = path.resolve(import.meta.dirname, "..", "src");

/** Adds a `.ts`/`.tsx` extension, or an `/index.ts`, when one exists. */
function withExtension(absolute) {
  if (existsSync(absolute) && !absolute.endsWith(path.sep)) return absolute;
  for (const candidate of [
    `${absolute}.ts`,
    `${absolute}.tsx`,
    path.join(absolute, "index.ts"),
    path.join(absolute, "index.tsx"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function resolve(specifier, context, next) {
  // `@/x` -> <repo>/src/x
  if (specifier.startsWith("@/")) {
    const resolved = withExtension(path.join(SRC, specifier.slice(2)));
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  // Extensionless relative imports.
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const parentPath = context.parentURL
      ? path.dirname(fileURLToPath(context.parentURL))
      : process.cwd();
    const resolved = withExtension(path.resolve(parentPath, specifier));
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  return next(specifier, context);
}
