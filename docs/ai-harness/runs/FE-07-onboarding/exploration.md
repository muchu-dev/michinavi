# FE-07 オンボーディング: exploration

## Repository findings

- The project uses Next.js 16.3.2 App Router, React 19, Tailwind CSS 4, Supabase SSR, tRPC, Vitest, and React Testing Library.
- `/login` is implemented and successful authentication currently redirects directly to `/`.
- The authenticated application shell and map top page already exist under the `(app)` route group.
- `user.setup` can create the authenticated user's `users`, `households`, and primary `household_members` rows with display name, age group, area, mesh code, and car count.
- The current database migration does not contain `pets`, `care_needs`, or `household_member_care_needs`, even though the ER design includes them.
- There is no address geocoding or address-to-area/250m-mesh API. BE-09 and BE-10 are both marked unstarted in the saved task snapshot.
- Exact address strings must not be persisted; the repository design requires conversion to `area_id` and 250m mesh first.
- Existing brand, surface, text, focus, status, shadow, and Japanese typography tokens can be reused.
- Existing family/map icon assets may be reused only where the glyph matches; the exact Figma logo asset is already present.

## Implementation boundary

- Implement the eight-screen visual/interaction flow as `/login` plus a seven-step `/onboarding` wizard.
- Keep the draft only in React memory for the current wizard session; do not place household, care, or address data in local/session storage.
- Request geolocation and notification permission only from an explicit user action and allow continuation after denial.
- Redirect successful real authentication to `/onboarding`.
- In development auth-bypass mode, expose a clearly labeled onboarding preview link from `/login`.
- Do not claim server persistence. Completion must disclose that saving awaits the backend connection.
