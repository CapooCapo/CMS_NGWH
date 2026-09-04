/**
 * Module-resolution hook for `node --test`.
 *
 * The source is written for Next's bundler resolution, which allows
 * extensionless relative imports and the `@/*` path alias. Node's ESM resolver
 * supports neither, so this hook teaches it both instead of pulling in a
 * separate TypeScript runner just to run unit tests.
 *
 * Registered with `--import ./tests/resolve-hook.mjs`.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(
  new URL("./resolve-hook-impl.mjs", import.meta.url),
  pathToFileURL("./")
);
