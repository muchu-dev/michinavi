# FE-07 オンボーディング: task plan

## Classification and design direction

- Standard frontend task with multi-step state, browser permissions, responsive UI, accessibility, and routing.
- Purpose: collect the minimum disaster-planning context in short, calm steps.
- Audience: residents using a phone, including older and stressed users who need high scanability and large targets.
- Tone: calm, direct, trustworthy, and non-clinical.
- Memorable detail: a compact blue progress rail that preserves orientation without competing with the question.
- Constraints: mobile-first Figma intent, Japanese copy, WCAG 2.2 AA, no exact-address persistence, no new visual dependency.

## User journeys

1. A first-time user can start from the login screen and understand why location/notification and household information are requested.
2. A keyboard or screen-reader user can select age, gender, household conditions, and address method using native controls with visible focus and errors.
3. A user can move forward and backward without losing selections during the current wizard session.
4. A user who denies location/notification permissions can still continue and enter an address manually.
5. A developer without Supabase can open `/login`, choose the explicit preview link, finish the wizard, and reach the existing map.
6. A production user who logs in successfully is sent to `/onboarding` before the map.

## Execution plan

1. Establish RED for page sequence, validation, back/forward preservation, permission handling, completion, and login routing.
2. Add reusable onboarding shell, progress, field/choice components, and seven step views.
3. Add an in-memory typed draft and deterministic validators; never persist sensitive draft fields in browser storage.
4. Add the development preview entry and change successful login destination.
5. Reach GREEN and verify coverage, lint/typecheck, production build, development HTTP routes, security patterns, and diff.

## Source consultation record

- Consulted: saved task snapshot, Notion requirements/UI/MN-1, Figma metadata and user screenshot, repository ER/security docs, local Next.js 16 docs.
- Figma limitation: individual design context unavailable due plan call limit; no guessed exact pixel values or missing asset drawings.
- Skipped: Miro because the flow is explicitly supplied and unambiguous.

## Execution notes

- Implemented `/onboarding` as a seven-step, in-memory wizard following the supplied eight-screen sequence including login.
- Added the local-development preview entry on `/login`; real authentication now redirects to `/onboarding`.
- Persistence is intentionally not connected: BE-09/BE-10 now provide part of the backend path, but the preview fields cannot yet produce the required member, pet, care-need, area, and mesh payload without inventing data. The exact contract gaps are recorded in `backend-handoff.md`.
- Verification: 33 frontend tests passed; coverage 94.38% statements / 94.07% branches / 85.96% functions / 94.64% lines; Biome and TypeScript passed.
- Production build: Next.js Turbopack reached an internal compile failure without an actionable source error in this environment; the supported `next build --webpack` path completed successfully and generated `/login` and `/onboarding`.
- Runtime: auth-bypass development server restarted on port 3000; `/login` and `/onboarding` both returned HTTP 200 with their expected screen copy.
- Browser QA limitation: Chromium/Playwright is not installed in this environment, so visual screenshots and automated focus traversal could not be captured. Semantic interactions are covered with Testing Library.
