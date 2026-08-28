# FE-06 ログイン画面: exploration

## Repository findings

- Stack: Next.js 16.3.2 App Router, React 19.2.8, TypeScript, Tailwind CSS 4.
- Authentication provider: Supabase Auth through `@supabase/ssr` 0.12.4 and `@supabase/supabase-js` 2.112.3.
- `src/lib/supabase/server.ts` already validates bearer or cookie credentials for tRPC, but its cookie client is intentionally read-only.
- The authenticated application lives under the `(app)` route group. The top page is `/` and renders the map.
- There is no login route, writable Server Action client, session-refresh Proxy, or login form.
- Existing frontend tests use React Testing Library with Vitest and JSDOM.
- Existing global tokens already include the Figma brand blue (`--brand: #597ebf`), white surface, outline, and foreground colors.

## Reuse decisions

- Reuse existing color and typography tokens from `src/app/globals.css`.
- Keep the interactive login form as a small Client Component and keep authentication in a Server Action.
- Add a separate writable Supabase server client rather than changing the existing request-context client, whose read-only behavior is deliberate.
- Use the official Supabase SSR Proxy pattern to refresh cookies and redirect anonymous application-page requests.
- Download and commit the exact Figma logo asset instead of recreating its vectors.

## Workflow note

The repository classifies this as a standard frontend task. Exploration, documentation research, planning, implementation, evaluation, verification, and review are executed sequentially in the primary context because sub-agent delegation is not enabled for this run.
