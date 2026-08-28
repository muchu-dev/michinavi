# FE-07 オンボーディング: sprint contract

## Acceptance criteria

1. `/login` remains directly accessible and displays the existing login design.
2. Real login success redirects to `/onboarding`; local auth-bypass displays a clearly labeled preview entry without accepting fake credentials.
3. `/onboarding` implements, in order: permission notice, household introduction, age/gender, pet/car, household/care needs, frequent place, completion.
4. Progress and Back/Next controls expose the current step, and going back preserves the current in-memory draft.
5. Age/gender, pet/car, household count/care needs, and place method have native semantic controls, validation, error association, keyboard operation, and visible focus.
6. Geolocation and notification permission requests happen only after a user gesture; unsupported/denied states do not trap the user.
7. Completion discloses that server saving is not connected, and `はじめる` navigates to the existing map.
8. No exact address, household, care, or permission data is written to localStorage/sessionStorage/logs.
9. Layout is usable from 320px through desktop using existing brand tokens and ≥44px primary actions.
10. Focused tests, frontend test suite, coverage thresholds, lint, typecheck, and production build pass.

## Change boundary

- May change: login redirect/form preview affordance, `/onboarding`, onboarding components/tests/types, coverage configuration, and task evidence.
- Must not change: Supabase schema, BE-09/BE-10 APIs, task snapshots, external product/design sources, existing map data, or production auth enforcement.

## Stop and handoff conditions

- Do not manufacture `area_id`/mesh values or save an exact address.
- Do not add pets/care tables or a geocoding provider in this frontend sprint.
- Server persistence and re-display remain blocked on BE-09/BE-10 and are documented in `backend-handoff.md`.
