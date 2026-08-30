# FE-07 オンボーディング: backend handoff

## Blocking backend work

- BE-09: accept, validate, save, and return household member counts/age groups, care-needs flags, pets, and car information under authenticated RLS.
- BE-10: convert current coordinates, postal code, or prefecture/city/address input into an `area_id` and 250m mesh without persisting the exact address string.
- Add the designed `pets`, `care_needs`, and `household_member_care_needs` schema/RLS/API before connecting those fields.
- Connect wizard completion to `user.setup` / `household.update`. `household.get` returning data is now used to recognize users whose initial household has already been created, but the current in-memory wizard still does not create that data.

## Required contract properties

- Resolve the user and household from the authenticated JWT, never from client-supplied owner/user IDs.
- Return field-safe errors and an idempotent result.
- Do not log or retain exact address, medical free text, permission state, or location history.
- Provide a read endpoint so FE-07 can satisfy saved-value re-display.

## Frontend readiness

The wizard will expose a typed draft boundary and validation behavior. Replace the in-memory completion with the backend mutation only after these contracts and integration tests exist.
