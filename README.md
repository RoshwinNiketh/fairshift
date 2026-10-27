# FairShift — SDG 8

FairShift supports decent work through transparent shift records, estimated pay, safety follow-up, and worker well-being. Built for PromptWars 2026. [Production application](https://thefairshift.vercel.app/).

## Current implementation

React 18, Vite, Tailwind CSS, Supabase PostgreSQL/Auth/RLS, and a static Vercel deployment. Production talks directly to Supabase. There is no Express API or server database in this repository.

- Authenticated workers see their own shifts, earnings, safety reports, and Skill Passport. Employers see operational records only for their assigned organizations.
- Check-in/out uses server time, stored pay rules, row locking, and one-active-shift constraints. Estimated pay separates regular and overtime hours and can be printed or saved with the browser's PDF printing.
- Workers submit account-linked safety reports; employers document resolutions. Worker and employer sessions see the same database records.
- Skill Passport entries support add/edit and are explicitly self-reported, not independently verified certificates.
- Workplace feedback covers environment, pay/scheduling fairness, safety, communication, and satisfaction. Employers cannot read individual feedback rows, comments, or worker IDs. Summaries require at least three distinct contributors and use each worker's latest response.
- Fatigue monitoring applies configured daily limits, rest intervals, and rolling seven-day hours. These are operational rules, not medical predictions or legal advice.
- English/Tamil UI and a deterministic context-aware assistant use the selected authorized workspace's actual records. Conversation context resets when worker, organization, role, or language changes.
- The explicit **Standalone demo** keeps synthetic records only in that browser. Authenticated failures never silently write into local demo data.

Synthetic industries: **BuildRight Infrastructure Ltd** (construction) and **Apex Heights College Facilities** (college support). Both are available in standalone demo; assigned accounts are required for shared access.

## Security model

All eight application tables have RLS. Organization memberships and roles are provisioned by the project owner, not trusted from client metadata. Workers cannot change roles, pay rates, shift timestamps/calculations, report ownership/audit fields, or other workers' skills. Direct shared-record deletion is denied. Public RPCs use invoker security; privileged helpers live in an unexposed schema with pinned search paths and explicit authorization. Table writes are limited to permitted columns.

The frontend uses only a Supabase publishable key. Never put service-role keys, database passwords, passwords, or user tokens into Vite variables or source. `.env.local` and `.qa-accounts.local` are ignored by Git and Docker. Vercel applies CSP, frame blocking, MIME sniffing protection, referrer policy, and disabled unused device permissions.

Workspace selection has one controller. Responses from previous organizations or sessions cannot overwrite the current workspace; logout clears displayed records and invalidates pending responses. RLS remains the authorization boundary.

## Local setup

Use Node 22 or newer and npm.

```sh
npm ci
cp .env.example .env.local
# Fill in the project URL and PUBLIC publishable key only.
npm run dev
```

The development server binds to loopback by default. Without public configuration, standalone demo remains available and shared sign-in clearly states that it is unconfigured.

For a fresh Supabase project, apply `supabase/migrations/` in filename order, then `supabase/seed.sql`. Do not edit previously applied migrations. The seed is insert-only with `ON CONFLICT DO NOTHING`; it does not reset existing records. Regenerate it with `node scripts/generate-seed.mjs`.

Create Auth users through the Supabase dashboard, then adapt `supabase/provision-accounts.sql` to assign memberships and worker links. Public self-signup is disabled; accounts are provisioned by the project owner. Passwords do not belong in SQL templates or Git. Existing private synthetic-account credentials may be kept in the local ignored `.qa-accounts.local` for verification, never in the public bundle.

## Verification

```sh
npm test
npm run build
npm audit --omit=dev
npm audit
node scripts/audit-secrets.mjs
npm run test:security:remote
```

`npm test` runs local calculation/assistant tests, mocked browser-storage demo tests, and asynchronous workspace race/logout tests. These are not browser tests.

`test:security:remote` requires the ignored public `.env.local` configuration and private `.qa-accounts.local` worker/employer fixtures. It tests real Supabase Auth and read-only RLS access. Session persistence in this script uses an SDK memory adapter; actual browser persistence is checked separately.

`supabase/tests/security_rollback.sql` exercises real PostgreSQL RLS, allowed and denied writes, report audit fields, skill isolation, duplicate shifts, and feedback thresholds. It creates isolated temporary fixtures in a transaction and rolls them back. Run the complete file as the project owner in the Supabase SQL editor; never remove its transaction/rollback boundary.

The secret scanner checks nonignored text, all reachable Git history, built JavaScript, and exact known private fixture passwords. It records file/revision names, never credential values. It is a high-signal scan, not proof that every possible secret format is absent.

## Deployment

The existing Vercel project builds `npm run build` and publishes `dist`. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for Production. Supabase Auth Site URL is `https://thefairshift.vercel.app`; the allowed production redirect is `https://thefairshift.vercel.app/**`. Push verified changes to the sole branch, `main`.

A static container path is retained for container/Cloud Run submission compatibility:

```sh
docker build --build-arg VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY -t fairshift .
docker run --rm -e PORT=8080 -p 8080:8080 fairshift
```

The runtime uses unprivileged Nginx and honors `PORT`; it does not include Express or application credentials. Public Vite configuration is embedded at build time. The Docker daemon must be running to validate this path.

## Genuine limits

Shared data refreshes after writes, every 15 seconds, and on window focus; Supabase Realtime is not implemented. College authenticated demo accounts may not yet exist. Feedback is account-linked and is not fully anonymous. Certificates are self-reported. Voice, secure QR/location verification, self-service invitations, and feedback trend analytics are deferred. Pay statements are estimates, not official payroll/tax documents. Demo role switching is a simulation, not authentication. Supabase access JWTs remain valid until their configured expiry after logout; local logout removes this browser's persisted session without signing out independent sessions.

See `docs/SECURITY_REVIEW.md` for the current audit, evidence, cleanup inventory, limitations, and verification results. Historical UI screenshots and earlier sprint reports remain as submission evidence, not current test-count claims.