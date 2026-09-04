import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Supabase を必要としないので、DB を起動せずに単体で実行できる
    environment: "jsdom",
    // テストは実装の隣に置く
    include: ["src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: [
        "src/app/(app)/error.tsx",
        "src/app/(app)/loading.tsx",
        "src/app/auth/confirm/route.ts",
        "src/app/forgot-password/actions.ts",
        "src/app/login/actions.ts",
        "src/app/not-found.tsx",
        "src/app/onboarding/page.tsx",
        "src/app/reset-password/actions.ts",
        "src/components/app-shell/**/*.tsx",
        "src/components/auth/**/*.tsx",
        "src/components/family/**/*.tsx",
        "src/components/map/**/*.tsx",
        "src/components/onboarding/**/*.tsx",
        "src/components/post/**/*.tsx",
        "src/components/report/**/*.tsx",
        "src/components/state/**/*.tsx",
        "src/config/navigation.ts",
        "src/lib/a11y/**/*.ts",
        "src/lib/auth/**/*.ts",
        "src/lib/auth/development-bypass.ts",
        "src/lib/media/**/*.ts",
        "src/lib/network/**/*.ts",
        "src/lib/onboarding/**/*.ts",
        "src/lib/report/**/*.ts",
        "src/lib/supabase/proxy.ts",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
});
