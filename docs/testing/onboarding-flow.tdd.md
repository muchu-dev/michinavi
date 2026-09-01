# Onboarding flow TDD evidence

## RED

The focused test run failed for the expected reasons before implementation:

- `onboarding-flow.tsx` did not exist.
- Login success redirected to `/` instead of `/onboarding`.
- The development-only preview link was absent from the login form.

## GREEN

- `VITEST_INTEGRATION=false mise exec -- pnpm test`: 33 tests passed.
- `VITEST_INTEGRATION=false mise exec -- pnpm test:coverage`: all configured thresholds passed.
- Coverage: 94.38% statements, 94.07% branches, 85.96% functions, 94.64% lines.
- `mise exec -- pnpm lint`: Biome and TypeScript passed.
- `APP_ENV=production DEV_AUTH_BYPASS=false mise exec -- pnpm exec next build --webpack`: passed; `/login` and `/onboarding` were generated.
- Development HTTP smoke test: `/login` and `/onboarding` returned 200.

## Covered behavior

- Ordered progression through the complete onboarding sequence.
- Permission denial and missing browser permission APIs do not block progress.
- Required-field validation for profile, pet/car, household/care needs, and place input.
- Back navigation preserves selected in-memory values.
- Postal-code and prefecture/city place methods.
- Completion callback and default map navigation.
- Development preview is only rendered when explicitly supplied by the server page.
