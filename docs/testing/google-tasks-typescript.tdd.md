# Google Tasks TypeScript migration — TDD evidence

## Source and user journey

The acceptance criteria were derived from issue #4 as quoted in the implementation request.

As a contributor, I want the Google Sheets task CLI to be a directly executable TypeScript module so that its workbook data and command boundaries are checked by the project's existing type checker without maintaining compiled output.

## Evidence

| Guarantee | Validation | Result | Evidence |
| --- | --- | --- | --- |
| The expected TypeScript entry point is required | `mise exec -- pnpm exec tsgo --ignoreConfig --noEmit --module esnext --moduleResolution bundler --target esnext --strict --types node scripts/google-tasks.ts` before implementation | RED | `TS6053: File 'scripts/google-tasks.ts' not found` |
| The migrated script passes strict standalone checking | The same targeted `tsgo` command after implementation | PASS | Exit code 0 |
| The script is included in the existing project type check | `mise exec -- pnpm typecheck` | PASS | Next route types generated and `tsgo --noEmit` exited 0 |
| Node directly executes all three TypeScript CLI modes | `mise exec -- pnpm tasks:status`, `mise exec -- pnpm tasks:check`, and `mise exec -- pnpm tasks:sync` | PASS | Status printed, check reported no update, and sync completed for 8 tabs / 78 tasks |

## Coverage and merge evidence

This repository has no unit-test or coverage script. Runtime coverage was therefore not collected; the migration is covered by strict compile-time checks and the three CLI integration runs above. No checkpoint commits were created because the worktree already contained unrelated user changes that must not be included in an automated commit.
