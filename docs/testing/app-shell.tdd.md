# App shell TDD evidence

Date: 2026-08-25

## Scope and acceptance criteria

- FE-01: A mobile-first Next.js web application shell starts locally.
- FE-02: The local application and the existing tRPC health endpoint respond.
- FE-03: A Leaflet map renders OpenStreetMap tiles with attribution.
- FE-04: The persistent navigation exposes Map, Posts, Evacuation Plan, and Family destinations.
- Destination-specific product features remain placeholders in this iteration.

The task source check was run before implementation with
`mise exec -- pnpm tasks:check`; the local snapshot matched the canonical Google
Sheet.

## RED

Command:

```sh
mise exec -- pnpm test -- src/components/app-shell/app-navigation.test.tsx
```

Result: failed because `./app-navigation` did not exist. This established the
four-destination navigation and current-page semantics as missing behavior.

Checkpoint: `fdcc434 test: add app shell navigation RED coverage`

## GREEN and refactor

The shell, four routes, accessible navigation, Leaflet map, OpenStreetMap tile
layer, responsive styles, and placeholders were implemented. Focused component
tests were then added for the shell, navigation, placeholders, map configuration,
tile attribution, route conditions, and map loading state.

Checkpoint: `da51fa4 feat: add mobile app shell and Leaflet map`

Final automated result:

```text
Test files: 5 passed
Tests: 10 passed
Statements: 90.90%
Branches: 100%
Functions: 81.81%
Lines: 90.90%
```

## Verification

- `mise exec -- pnpm lint`: passed (Biome, route type generation, and tsgo).
- `mise exec -- pnpm exec next build --webpack`: passed; all application routes
  were generated.
- Local HTTP checks: `/`, `/posts`, `/evacuation`, `/family`, and
  `/api/trpc/health.ping` returned HTTP 200.
- Chromium QA at 390x844, 768x1024, and 1440x900: no horizontal overflow, four
  navigation links, loaded map tiles, and no console or page errors.
- Each destination URL exposed the matching `aria-current="page"` navigation
  state.

The default Turbopack production command was also attempted both inside and
outside the sandbox. This runner rejects Turbopack's internal helper process
when it binds a port (`Operation not permitted`); the Webpack production build
is the environment-compatible verification path. Turbopack development mode
starts successfully.
