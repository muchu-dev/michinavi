import { createEnv } from "@t3-oss/env-nextjs";
import z from "zod";

export const env = createEnv({
  // Client Component
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string()
  },
  // Server Component / Route Handler
  server: {
    APP_ENV: z.enum(["production", "preview", "local"])
  },
  runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    APP_ENV: process.env.APP_ENV
  }
})
