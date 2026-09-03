# FE-06 ログイン画面: docs research

## Sources consulted

- Canonical task sheet snapshot: FE-06 requires registration/login UI and defines success as entering the top page after login; BE-08 allows email or SMS and requires working authentication.
- Notion `03_要件定義`: confirmed the product handles private household/location information and must avoid exposing it.
- Notion `04_UI画面設計`: confirmed the resident-facing application scope and Japanese-first product context.
- Figma file `michinavi`, node `7:945` (`page2`): confirmed the login screen, logo, email/password fields, primary sign-in button, and password-recovery link.
- Next.js 16.3.2 bundled authentication guide: use forms with Server Actions and `useActionState`, validate server-side, set cookies on the server, and treat Server Actions as public endpoints.
- Supabase official SSR documentation and current Next.js example: use `createServerClient` with `cookies.getAll`/`setAll`; refresh and verify the token in `proxy.ts` with `auth.getClaims()`; never trust `getSession()` for authorization.

## Sources skipped

- Miro: skipped because the self-contained login screen, its successful destination (`/`), and the task acceptance criteria are unambiguous in Figma, the task sheet, and the repository.

## Implementation constraints derived from sources

- Credentials are processed only in a Server Action and are never logged.
- Invalid credentials use a generic user-facing message.
- The server validates email and non-empty password before calling Supabase.
- Auth state is stored in Supabase-managed cookies, not application `localStorage`.
- Inputs use persistent labels, autocomplete hints, error associations, and keyboard-native controls.
- The Figma iPhone chrome is reference context only; the production page remains responsive web UI.
