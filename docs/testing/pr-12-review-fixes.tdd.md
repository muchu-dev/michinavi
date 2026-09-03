# PR #12 review fixes: TDD evidence

## Source and scope

- Source: PR #12 review comments, FE-06/FE-07 task records, Notion requirements, and the repository-local Next.js 16.3.2 documentation.
- Figma could not be reached through the connector. These fixes do not change visual design, and no missing design detail was inferred.
- Miro was skipped because no new screen transition or information architecture decision was required.

## User journeys

1. A user whose initial household already exists does not repeat onboarding after signing in.
2. A first-time user, or a developer using the Supabase-free local preview, can still enter onboarding.
3. An expired auth session is redirected to login with cookie deletion and all auth cache-prevention headers intact.
4. A developer enables auth bypass only through the checked-in `.env.local` instructions; scripts do not override `APP_ENV`.

## RED and GREEN

| Behavior | RED evidence | GREEN evidence |
| --- | --- | --- |
| Existing household skips onboarding | Page test resolved to `<OnboardingFlow />` instead of redirecting; completion helper import was missing | `page.test.tsx` and `completion.test.tsx` pass for household found, `NOT_FOUND`, non-`NOT_FOUND`, and local bypass |
| Redirect preserves an expired-session deletion | Redirect response had no `sb-auth-token` deletion cookie | Proxy test passes with empty cookie, `Max-Age=0`, and login location |
| Redirect preserves cache-prevention headers | Redirect response omitted the headers written by `setAll` | Proxy test passes for `Cache-Control`, `Expires`, and `Pragma` |

Focused RED/GREEN command:

```text
mise exec -- pnpm --filter @michinavi/frontend exec vitest run src/lib/supabase/proxy.test.tsx src/lib/onboarding/completion.test.tsx src/app/onboarding/page.test.tsx src/app/login/actions.test.tsx
```

Final focused result: 4 files, 19 tests passed.

## Final verification

| Check | Command | Result |
| --- | --- | --- |
| Frontend coverage | `VITEST_INTEGRATION=false mise exec -- pnpm --filter @michinavi/frontend test:coverage` | 11 files / 40 tests passed; 94.94% statements, 94.40% branches, 86.44% functions, 95.21% lines |
| Lint and typecheck | `mise exec -- pnpm lint` | Passed after moving stale `.next/dev/types` cache out of the workspace |
| Production build | `mise exec -- pnpm --filter @michinavi/frontend exec next build --webpack` | Passed; `/onboarding` is dynamically server-rendered and Proxy is recognized |
| Workspace tests | `VITEST_INTEGRATION=false mise exec -- pnpm test` | Backend suite could not start because local Supabase requires Docker/Podman, neither of which is installed |

## Known boundary

The current onboarding wizard intentionally keeps its draft in memory and does not call `user.setup` or `household.update`. Household existence therefore skips onboarding only for users whose setup data has already been created through the backend. Persisting the wizard is a separate BE-10/frontend integration task and is not claimed by this change.
