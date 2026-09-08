This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Login limiter deployment (PostgreSQL / Supabase)

Both login routes use `login_rate_limits` through the existing server-side
`DATABASE_URL` pool. Set a stable, random `LOGIN_RATE_LIMIT_SECRET` on every
instance (including local development) to HMAC-obscure account/IP identities.
Never expose it through a `NEXT_PUBLIC_` variable. Set `DB_SSL=true` when required
by the provider, with a trusted certificate chain.

Before deploying the application, run `node scripts/migrate.mjs` from `web/`
with `DATABASE_URL` in the process environment. For a local `.env.local`, run
`npm run db:migrate`. Migration `011_login_rate_limits.sql` is discovered by the
existing runner. The backend database role must have table privileges and
bypass RLS (or own the table); browser-facing Supabase roles have no RLS policy.

The first five failures are allowed; the sixth starts a lock. Further cycles
progress through 30, 60, 120, then 300 seconds. Failure history and progressive
level each expire logically after 15 minutes. Blocked requests do not refresh
timestamps. Success resets only the account row. Trusted IP history remains
independent; enable `TRUST_PROXY_X_FORWARDED_FOR=true` only behind a proxy that
overwrites that header correctly.

The previous external limiter service is no longer needed. Its existing locks
are not imported: the new table starts with fresh history on cutover. Remove
the old provider environment variables after rollout. Changing the HMAC secret
also starts new identities; keep it stable across deployments.

Missing secret, missing migration, database permission errors or database
unavailability fail closed with opaque HTTP 503. Server logs emit only the
operation and a sanitized reason. A normal lock returns 429 with `Retry-After`.

Expiry does not need a cron job. Rows are retained for reuse; an operator may
periodically delete rows only when all three expiry timestamps are null or
expired. Such cleanup must coordinate with active login traffic; no background
cleanup is required for correctness. CI uses its PostgreSQL service and a
test-only HMAC secret, without an external limiter service.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
