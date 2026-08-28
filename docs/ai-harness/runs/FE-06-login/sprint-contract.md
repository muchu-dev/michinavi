# FE-06 ログイン画面: sprint contract

## Acceptance criteria

1. `/login` renders the Figma `page2` visual hierarchy: brand-blue full-height background, exact white logo, centered white form surface, email/password fields, primary action, and password-recovery affordance.
2. The layout remains usable without horizontal overflow at 320×568, 390×844, 768×1024, and 1440×900.
3. Email and password have programmatically associated visible labels, correct input types/autocomplete values, and a logical keyboard order.
4. Empty or malformed credentials are rejected before Supabase is called, with errors associated to the relevant inputs.
5. Supabase authentication failures display a generic Japanese message without exposing provider/internal details.
6. While submission is pending, the primary button is disabled and communicates progress.
7. Successful `signInWithPassword` writes Supabase session cookies and redirects to `/`.
8. Anonymous navigation to application pages redirects to `/login`; `/login`, API routes, Next.js assets, and static image assets remain public.
9. The focused tests, project tests, coverage thresholds, lint, typecheck, and production build pass.

## Change boundary

- May change: login route/components/actions/tests, Supabase SSR utilities, Next.js Proxy, exact Figma logo asset, global auth-specific tokens/styles, Vitest coverage configuration, and this run's evidence documents.
- Must not change: database schema, Supabase server configuration, task sheet snapshots, unrelated map/app-shell behavior, or external product/design sources.

## Evaluation

UI evaluation is required because layout, input, keyboard behavior, asynchronous states, errors, and routing change.

## Stop conditions

- Stop and record a backend handoff if Supabase password auth is unavailable or requires project-level configuration changes.
- Stop rather than invent requirements if Figma and canonical product requirements conflict on the login method.
