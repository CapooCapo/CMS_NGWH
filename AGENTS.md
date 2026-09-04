# Repository Guidelines

## Project Structure

This workspace contains two independent Git repositories (run Git commands from the relevant directory):

- `web/` is the Next.js 16 application. Route files live in `src/app/`; reusable UI in `src/components/`; CMS code in `src/sanity/`; and the PostgreSQL backend is layered under `src/server/` (`repositories`, `services`, `validation`, and `migrations`). Node tests are in `tests/`.
- `studio/` is the Sanity Studio. Content schemas are in `schemaTypes/`, custom desk structure in `src/structure/`, and content-maintenance scripts in `scripts/`.
- `docker-compose.yml` runs the local PostgreSQL database on port 5433. `.ai/` contains the product requirements and design-system references.

Editorial content belongs in Sanity; registrations, clubs, matches, accounts, and other transactional data belong in PostgreSQL.

## Build, Test, and Development

From `web/`, use `npm run dev`, `npm run build`, `npm run lint`, and `npm test`. Run `npx tsc --noEmit` before submitting TypeScript changes. Start PostgreSQL from the workspace root with `docker compose up -d`, then apply forward-only migrations with `npm run db:migrate`.

From `studio/`, use `npm run dev`, `npm run build`, and `npx eslint .`. After changing a Studio schema or `web/src/sanity/queries.ts`, run `npm run typegen` from `studio/`; it regenerates `studio/schema.json` and `web/sanity.types.ts`. Do not hand-edit generated types.

## Coding Style and Data Safety

Use TypeScript and the existing App Router conventions. Components use PascalCase filenames (for example, `ClubCard.tsx`); utilities and server modules use camel-case names (for example, `ownerClub.ts`). Follow the local ESLint configuration; Studio formatting uses single quotes, no semicolons, and 100-column lines.

Keep SQL parameterized, add rather than alter applied migration files (`NNN_description.sql`), and return API responses through `src/server/api/respond.ts`. Update both `web/messages/en.json` and `web/messages/vi.json` for UI copy changes.

## Testing

Tests use Node's built-in runner, named `tests/*.test.ts`. `npm test` runs the full suite; do not use `npm test -- <file>` to select one file, because its script already supplies `tests/*.test.ts`. Prefer focused unit tests for permissions and validation; DB and live-server suites may self-skip without their dependencies, so review skip output. To run exactly one file, use:

```bash
node --test --env-file-if-exists=.env.local --conditions=react-server \
  --import ./tests/resolve-hook.mjs tests/permissions.test.ts
```

## Commits and Pull Requests

History currently only establishes short, imperative Conventional Commit-style subjects, such as `feat: bootstrap sanity studio`. Use that form (`feat:`, `fix:`, `chore:`), keep commits scoped to one app when possible, and do not commit secrets or `.env.local` files. PRs should state the affected app, summarize behavior and migration/content-model implications, link the issue when available, include test results, and attach screenshots for visible UI changes.
