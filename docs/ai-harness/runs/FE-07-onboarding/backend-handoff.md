# FE-07 オンボーディング: backend handoff

## Current backend capability

- `user.setup` creates the authenticated user's profile, initial household, and primary household member.
- `household.get` and `household.update` read and replace the authenticated user's household data.
- `area.resolveFromAddress` exists on `main` and resolves a town-level name embedded in an address to `areaId`.
- A coordinate-to-10-digit-mesh utility is being developed separately, but address or postal-code geocoding is not part of that utility.

These APIs make persistence possible after the frontend collects their required fields. They do not make the current preview draft safe to persist as-is.

## Contract gaps to resolve before persistence

| Wizard input | Backend requirement | Gap |
| --- | --- | --- |
| 年代 (`-10代`, `20代` …) | `infant \| child \| adult \| senior` for every member | `-10代` spans multiple backend groups, and only the primary user's age is collected. |
| 性別 | No destination field | Decide whether to remove it or add an explicitly justified schema field. |
| 世帯人数 | A complete `members[]` list with display name and age group for each person | A count cannot be expanded into truthful member records. |
| 要配慮者 (`乳幼児`, `障がい者`, `なし`) | One or more of ten specific `careNeeds[].key` values per member | `障がい者` is not a safe one-to-one mapping and the affected member is unknown. |
| ペット (`あり`, `なし`) | `species`, `size`, `count`, and crate-training state | `あり` alone is insufficient. |
| 自動車 (`あり`, `なし`) | `carCount` | `あり` could map to at least one car, but the actual count is not collected. |
| 現在地 | `areaId` and 10-digit `homeMeshCode` | Permission state is retained, but coordinates are not retained or resolved. |
| 郵便番号 | `areaId` and 10-digit `homeMeshCode` | No postal-code geocoder currently provides either value. |
| 都道府県・市区町村 | Town-level address for `area.resolveFromAddress`, plus `homeMeshCode` | The town field is optional, the resolver returns no mesh code, and broad addresses may not match uniquely. |
| 初期プロフィール | `displayName` for `user.setup` | The wizard does not collect a display name. |

## Required integration sequence

1. Agree with backend/design on the fields and labels needed to create a truthful `user.setup` payload.
2. Add location resolution that returns both `areaId` and a 10-digit mesh for every supported input method, with an explicit unsupported/error state.
3. Extend the wizard to collect each member, concrete care-need keys, pet details, car count, and display name; do not infer absent sensitive data.
4. Submit `user.setup` first, then use `household.update` only after the primary member ID is available.
5. Add authenticated integration tests for save, retry/idempotency, validation errors, and reload/re-display before removing the preview-only notice.

## Required contract properties

- Resolve the user and household from the authenticated JWT, never from client-supplied owner/user IDs.
- Return field-safe errors and an idempotent result.
- Do not log or retain exact address, medical free text, permission state, or location history.
- Preserve the current `household.get` completion check so a saved household skips onboarding.

## Frontend boundary

FE-07 remains the task that owns persistence and re-display. This PR keeps the draft in memory because mapping incomplete inputs into the available API would invent household and care data. The orchestration state remains in `OnboardingFlow`; a custom hook is deferred until a second consumer or the persistence integration introduces reusable state behavior.
