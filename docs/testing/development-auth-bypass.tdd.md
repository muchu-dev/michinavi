# Development auth bypass TDD evidence

## Source and journey

- Source: user-requested follow-up to `docs/ai-harness/runs/FE-06-login/task-plan.md`.
- Journey: as a developer without a local Supabase container runtime, I can explicitly start the app in a local-only preview mode and inspect authenticated screens without weakening preview or production authentication.

## RED → GREEN

| Behavior | RED evidence | GREEN evidence |
| --- | --- | --- |
| Explicit local-development flag skips Supabase and serves `/` | Focused Vitest run failed because `getClaims()` was still called and returned `undefined` | Same focused run passed after adding the three-condition guard |
| Preview and production ignore the bypass flag | Added parameterized cases for `preview/development` and `local/production` | Both cases redirect anonymous `/` requests and call `getClaims()` |
| Production runtime remains protected with the flag forced on | Not applicable to the unit RED | Production HTTP returned `307 /login` and no bypass header |
| Local development visibly exposes diagnostic state | Header assertion failed before implementation | Local HTTP returned `200` with `x-michinavi-auth-bypass: development-only` |

## Commands and results

- RED: `VITEST_INTEGRATION=false mise exec -- pnpm test -- src/lib/supabase/proxy.test.tsx` → 1 intended failure.
- GREEN: same command → 8 files / 25 tests passed.
- Coverage: `VITEST_INTEGRATION=false mise exec -- pnpm test:coverage` → statements/lines 97.05%, branches 97.5%, functions 89.47%.
- Static checks: `mise exec -- pnpm lint` → Biome, route type generation, and `tsgo --noEmit` passed.
- Build: webpack production build passed and detected `ƒ Proxy (Middleware)`.
- Runtime safety: production with `APP_ENV=local DEV_AUTH_BYPASS=true` still returned `307 /login`; local Next.js development returned `/` with 200 and the diagnostic bypass header.

## Known gaps and merge evidence

- This mode intentionally does not verify real login, cookies, RLS, or user-specific data. Those require Supabase and normal `pnpm dev`.
- No TDD checkpoint commits were created because the user requested review before committing. The RED/GREEN evidence is preserved here.
