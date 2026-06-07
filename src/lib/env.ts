import { z } from "zod";

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL must be a valid URL"),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(20, "VITE_SUPABASE_PUBLISHABLE_KEY is missing or invalid"),
  VITE_SUPABASE_PROJECT_ID: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof EnvSchema>;

function parseEnv(): ClientEnv {
  const raw = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
  };
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    const message = `[env] Invalid client environment variables:\n${issues}`;
    // Fail fast — surfaces clearly in browser console & SSR logs
    console.error(message);
    throw new Error(message);
  }
  return parsed.data;
}

export const env = parseEnv();
