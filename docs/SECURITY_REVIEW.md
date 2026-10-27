# FairShift security hardening — 27 October 2026

Baseline: 17eb302. Scope: security, state correctness, dependency cleanup, and accurate documentation. No product feature or visual redesign was added.

## Repository classification and removals

| Group | Files | Decision |
|---|---|---|
| Production | src/, shared/, index.html, Vite/Tailwind configuration, Supabase SDK | Preserve |
| Tests | calculation, assistant, storage, local demo, workspace controller tests | Preserve; add targeted state/security regressions |
| Database/reproducibility | applied migrations, seed.sql, generation/provisioning scripts, public .env.example | Preserve unchanged applied migrations; add rollback-only tests |
| Submission evidence | UI screenshots, historical sprint/UI reports | Preserve (~1 MB); historical results are not current test claims |
| Legacy API | server/index.js, test/server_api.test.js | Delete after confirming only legacy scripts/container/README referenced them |
| Legacy dependencies | express, cors, body-parser and unused transitive graph | Remove with npm; 75 packages removed in initial uninstall |
| Container | Dockerfile, .dockerignore | Preserve deployment option; replace Express runtime with static unprivileged Nginx, honor PORT, exclude credentials |
| Generated/private | dist/, node_modules/, .env.local, .qa-accounts.local, logs | Ignore; never commit credentials or build output |

Removed package scripts `server`/`start` and the obsolete Vite /api proxy. Renamed misleading `browser_smoke.test.js` to `local_demo_flow.test.js` and labeled it mocked storage testing. The current Vercel build has no server API references. Container requirements were not discarded: a static container path remains. Docker runtime build/run could not be executed because Docker Desktop's daemon was unavailable; configuration was reviewed only.

## Security findings and fixes

- Confirmed race: parent organization selection and child-owned organization IDs could diverge when an older refresh arrived during switching. One workspace controller now owns session, selected organization, role, and response generation. The child derives shared IDs/data from that source. Old organization/session responses cannot publish, polling from an old scope is ignored, and logout invalidates pending work and clears memberships/data. No authorization rules were weakened.
- Removed the obsolete Express attack surface and its body-parser high-severity advisory.
- Vite 5 had development-only advisories. Updated deliberately to the minimum patched Vite 6.4.4 line and compatible React plugin 4.7.0, rather than force-upgrading to the latest major. Both production and complete npm audits report zero vulnerabilities.
- Added Vercel CSP, frame blocking, MIME sniffing protection, referrer policy, and disabled unused camera/microphone/geolocation permissions. CSP restricts backend connections to the actual Supabase project and does not allow inline scripts or inline styles.
- Public self-signup disabled after explicit user approval. Existing email/password login, email confirmation, administrator account provisioning, and organization assignments remain. Anonymous sign-in and manual identity linking were already disabled. Existing rate limits were preserved: sign-up/sign-in 30 requests / 5 minutes / IP, refresh 150 / 5 minutes / IP, verification 30 / 5 minutes / IP; source-IP forwarding disabled. No billing changes.

## Actual Supabase inspection

SUPABASE_CATALOG_AUDIT.json records live PostgreSQL catalog evidence. All eight application tables have RLS. SELECT/INSERT/UPDATE grants are restricted to intended tables/columns; no client DELETE grant. Memberships, wage rules, timestamps, shift calculations, report ownership, and audit columns are not client-editable. Private-schema anonymous usage and authenticated CREATE are denied. Public RPC wrappers are invoker-security, authenticated-only. Privileged helpers are postgres-owned, have empty pinned search_path, live in fairshift_private, and check the authenticated caller's ownership/membership. Trigger helpers have no client EXECUTE grant. The existing production RLS required no corrective migration.

**Database migrations applied in this hardening sprint: none.** Existing applied migration files were not edited. New security SQL creates disposable fixtures inside a transaction and rolls them all back. No existing records, memberships, roles, or wage data were reset or deleted.

## Verification evidence

- Local automated suite: **41 passed**. Nine obsolete server lifecycle tests removed (including their parent test); 10 targeted controller tests added. Useful calculations/assistant/storage/demo tests retained. These local tests include mocks and are not real-browser tests.
- **10 remote checks passed** using actual Supabase Auth and read-only PostgREST/RPC. See SUPABASE_TEST_RESULTS.json. Persistence probe uses an SDK memory adapter, explicitly not browser emulation. All anonymous tables/RPCs, cross-worker/cross-org reads, feedback privacy, real sign-in, persisted session restore, and independent-session logout checked.
- **23 live PostgreSQL assertions passed** in security_rollback.sql. Tested allowed and denied writes, role/rate/policy tampering, forged shifts, report ownership/audit metadata, unauthorized skills, duplicate active shifts, server pay totals, employer isolation, raw feedback privacy, suppression at two contributors, and aggregation at three contributors. Fixtures and attempted changes rolled back.
- Real browser candidate: authenticated worker data loads and restores after reload; logout tested separately; college standalone demo and Tamil rendering checked. Existing live worker/employer sessions are independent. Multi-authorized-organization switching and stale-response interleavings were tested deterministically in the local controller suite; current private demo login accounts each have one assigned organization, so a two-membership browser test was not claimed.
- Production build and git diff whitespace checks passed. Full history/working-text/built-JS secret scan found no high-signal credentials or exact private QA passwords in all 7 pre-hardening reachable revisions. Scanner records types and filenames, never secret values. This is a high-signal scan, not an exhaustive secret-format guarantee. Public history was not rewritten.

## Remaining limits and submission risks

No known npm audit advisories remain at verification time. Docker execution remains unverified while the daemon is unavailable. Two-organization authenticated browser switching needs a dedicated multi-membership fixture; local race tests and database organization isolation passed. Auth access JWTs remain valid until expiry after local logout, as with Supabase's normal bearer-token model; browser persisted sessions and displayed records are cleared. Realtime, independent certificate verification, full anonymous feedback, voice, and secure QR/location remain unimplemented and are documented honestly. No public/demo passwords, service-role keys, or database credentials were committed. No official evaluation submission was made.