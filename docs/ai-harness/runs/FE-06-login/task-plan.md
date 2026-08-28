# FE-06 ログイン画面: task plan

## Classification

Standard frontend task: it adds a route, interactive form state, authentication integration, responsive styling, accessibility behavior, and navigation.

## Source consultation record

- Consulted: canonical Google Sheet task snapshot (current as of the pre-implementation check), relevant Notion requirement/UI pages, Figma node `7:945`, local Next.js 16 docs, Supabase official SSR docs, and existing repository patterns.
- Skipped: Miro, because no unresolved flow or information-architecture question remains.

## User journeys

1. As a registered resident, I can enter my email and password and reach the map top page after successful authentication.
2. As a resident who mistypes or omits credentials, I receive a clear, non-sensitive error and can correct the form.
3. As a keyboard or screen-reader user, I can understand, complete, and submit the login form without relying on placeholders or pointer input.
4. As an anonymous visitor to application pages, I am redirected to the login screen while static assets and API routes remain unaffected.

## Execution plan

1. Add behavior-focused tests and establish RED.
2. Add the exact Figma logo asset and the responsive `/login` page.
3. Implement server-side validation and Supabase password sign-in through cookie-backed SSR.
4. Add Supabase session refresh and anonymous route protection with Next.js 16 Proxy.
5. Reach GREEN with focused tests and coverage.
6. Evaluate mobile, tablet, desktop, keyboard, error, and successful navigation states.
7. Run lint, typecheck, build, full tests, security scan, and diff review.

## Execution result

- Implemented the responsive `/login` route, Server Action validation/authentication, writable Supabase SSR cookie client, Next.js 16 Proxy session refresh/route guard, exact Figma logo asset, and a non-deceptive password-recovery placeholder route.
- Added behavior tests for accessible form semantics, field and service errors, pending state, successful redirect, anonymous/authenticated routing, and refreshed cookies.
- Corrected the Proxy entry point from the repository root to `src/proxy.ts` after production HTTP verification showed that a `src/app` project only discovers Proxy at the same level as `app`.
- Verification passed for frontend tests, coverage, lint, typecheck, webpack production build, diff whitespace, security-pattern scan, and production HTTP responses.
- Environment note: browser-engine QA and Supabase-backed integration tests remain unexecuted because this workspace has no Chromium/Playwright and no Docker/Podman runtime. These are recorded as unverified, not as passing evidence.

## Development auth bypass follow-up

- Requested behavior: allow the authenticated application screens to be previewed without Supabase during local development.
- Consulted: saved FE-06/BE-08 task entries, the existing login sprint contract, repository auth implementation, and bundled Next.js 16 Proxy documentation.
- Skipped: Notion, Figma, and Miro because this follow-up is a mechanical development-only routing configuration and does not change product requirements, screen design, or user flow.
- Safety boundary: bypass requires all three conditions—Next.js `development` mode, `APP_ENV=local`, and `DEV_AUTH_BYPASS=true`. Preview/production must continue to call Supabase and enforce authentication even if the flag is present.
- Verification: establish RED for the missing bypass, implement the minimum Proxy/env/script change, then run focused tests, coverage, lint/typecheck, build, an HTTP check, and a secret-pattern scan.
- Task-source note: `tasks:check` was attempted on 2026-08-28 but Google Sheets fetch failed; the saved canonical snapshot entries were used without syncing or writing externally.

## Scope boundaries

- Included: email/password login, validation/error/pending states, cookie session creation/refresh, anonymous app-route redirect, successful redirect to `/`, and the Figma password-recovery affordance.
- Excluded: registration, SMS login, password-reset delivery/update flow, Supabase project configuration, database migrations, and Google Sheet/Notion/Figma/Miro writes.
