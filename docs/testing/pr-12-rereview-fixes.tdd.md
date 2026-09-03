# PR #12 re-review fixes: TDD evidence

## Sources and scope

- Source: PR #12 approval review submitted 2026-08-31, FE-06/FE-07 task records, Notion requirements/UI/demo pages, current backend contracts, and the repository-local Next.js 16.3.2 `useRouter` documentation.
- Consulted: Google Sheet task snapshot (synced 2026-09-01), Notion `03_要件定義`, `04_UI画面設計`, and `08_発表デモ`.
- Figma: required but unavailable because the connected Starter plan reached its MCP call limit. No visual value or replacement asset was guessed.
- Miro: skipped because no new screen transition or information-architecture decision was needed.

## Review disposition

| Review item | Decision | Result or reason |
| --- | --- | --- |
| Connect BE-09/BE-10 persistence | Defer to FE-07 | The current draft cannot provide truthful `members`, pet details, care-need keys, display name, `areaId`, and 10-digit mesh values. Persisting inferred sensitive data would be incorrect. The exact mapping gaps and integration sequence are recorded in the backend handoff. |
| Split the 634-line flow | Implement | Seven step views, shared controls, and types were separated; the orchestrator is now 265 lines. |
| Extract prefectures | Implement | The 47 unique values now live in `src/lib/address/prefectures.ts`. |
| Replace `bg-red-50` with a token | Implement | `--impassable-soft` aliases the existing Tailwind red-50 value, preserving appearance while adding semantic ownership. |
| Use `router.replace` on completion | Implement | Completion no longer adds onboarding to browser history. |
| Focus errors | Implement | The error summary receives programmatic focus after failed validation, causing browser scroll and a visible focus target. |
| Replace the family navigation icon | Do not guess | Figma context was unavailable, so the correct dedicated asset and dimensions could not be verified. |
| Extract `useOnboardingDraft()` | Not yet | Draft orchestration has one consumer. A single-use hook would hide dependencies without reuse; reconsider when persistence creates shared state behavior. |

## User journeys

1. A user who completes onboarding reaches the map without adding the completed wizard to browser history.
2. A user who submits an incomplete step is brought to the visible and announced error summary.
3. Address forms reuse a complete, unique, geographically ordered prefecture list.
4. Future persistence work can see why the current preview data must not be coerced into the backend contract.

## RED and GREEN evidence

| Guarantee | RED evidence | GREEN evidence |
| --- | --- | --- |
| Completion replaces browser history | `routerReplace` had 0 calls because the implementation called `router.push` | `onboarding-flow.test.tsx` passes and verifies `replace("/")` with no `push` call |
| Validation focuses the summary | `document.activeElement` remained `body` | The alert is `document.activeElement` after failed validation |
| Prefecture data is reusable and complete | Compile-time failure: `Failed to resolve import "./prefectures"` | 47 entries, 47 unique values, from Hokkaido to Okinawa |
| Error surfaces use the semantic token | Both component tests received `bg-red-50` | Login and onboarding alerts render `bg-impassable-soft` |

RED checkpoints:

- `3684231 test: add regressions for onboarding rereview`
- `0e84723 test: require semantic onboarding error styling`

GREEN/refactor checkpoints:

- `8185a33 fix: address onboarding rereview behavior`
- `10c97bd refactor: split onboarding steps after rereview`

## Verification

| Check | Command | Result |
| --- | --- | --- |
| Frontend tests and coverage | `mise exec -- pnpm --filter @michinavi/frontend test:coverage` | 12 files / 42 tests passed; statements 95.23%, branches 95.17%, functions 88.23%, lines 95.47% |
| Lint and workspace typecheck | `mise exec -- pnpm lint` | Passed; 83 files checked and all four workspace typechecks completed |
| Production build | `APP_ENV=production DEV_AUTH_BYPASS=false mise exec -- pnpm --filter @michinavi/frontend exec next build --webpack` | Passed; `/login` static and `/onboarding` dynamically rendered |
| Diff whitespace | `git diff HEAD~3 --check` | Passed |
| Frontend secret/debug scan | `rg -n "console\\.log\|sk-[A-Za-z0-9]\|api[_-]?key" apps/frontend/src --glob '*.{ts,tsx,js,jsx}'` | No findings |

## Known gaps

- The workspace-wide `mise exec -- pnpm test` cannot start the backend suite because local Supabase is unavailable and neither Docker nor Podman is installed. The frontend suite itself is fully green.
- Figma visual comparison and the dedicated family illustration remain unverified due the connected plan's MCP limit.
- Persistence and saved-value re-display remain FE-07 work and are not claimed by this change.
