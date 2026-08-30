# Family screens TDD evidence

Date: 2026-08-30

## Scope and sources

- Canonical task tracker: synchronized before implementation; this work covers
  FE-16's Family status and sharing screen.
- Figma: the MCP call limit prevented direct retrieval. The user-provided
  screenshot and exported CSS were used as the visual source instead.
- Notion: unavailable because the connector returned a connection error. No
  product behavior beyond the local task and supplied design was inferred.
- Miro: skipped because the supplied screens made the implemented route flow
  unambiguous.

The implemented journey is `/family` -> `/family/settings` ->
`/family/connect`. The separate family-composition and personal-information
edit features remain disabled until their own screens are specified.

## RED

Command:

```sh
mise exec -- pnpm --filter @michinavi/frontend test -- \
  'src/app/(app)/family/page.test.tsx' \
  'src/app/(app)/family/settings/page.test.tsx' \
  'src/app/(app)/family/connect/page.test.tsx'
```

Result: failed because the two nested pages did not exist and the existing
settings row was not an accessible link.

No checkpoint commit was created because the worktree already contained
unrelated user changes.

## GREEN

The same command passed after adding the two pages and the route links:

```text
Test Files  8 passed (8)
Tests       14 passed (14)
```

## Test specification

| Guarantee | Test | Type | Result |
| --- | --- | --- | --- |
| Family status exposes an accessible settings link | `family/page.test.tsx` | Component | PASS |
| Family settings displays all three supplied menu labels and links to connection | `family/settings/page.test.tsx` | Component | PASS |
| Family connection displays its heading, QR placeholder, and read control | `family/connect/page.test.tsx` | Component | PASS |

## Verification

- `mise exec -- pnpm --filter @michinavi/frontend typecheck`: passed.
- `mise exec -- pnpm --filter @michinavi/frontend test:coverage`: 14/14
  tests passed; statements 90.9%, branches 100%, functions 81.81%, lines 90.9%.
- `mise exec -- pnpm --filter @michinavi/frontend exec next build --webpack`:
  passed and generated `/family`, `/family/settings`, and `/family/connect`.
- Local HTTP checks returned 200 for all three routes and confirmed both links.
- The default Turbopack build was attempted but this runner blocks the internal
  helper process from binding a port (`Operation not permitted`).
- Visual regression is inconclusive because no browser automation runtime or
  committed screenshot baseline is available in this environment.

## Known gaps

- The QR area remains the gray placeholder shown in the supplied design; no QR
  payload or scanner behavior was specified.
- Family-composition and personal-information editing belong to separate,
  unspecified screens and are intentionally disabled here.
