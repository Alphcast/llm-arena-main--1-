import "server-only";

import { z } from "zod";

/**
 * Every server-side environment variable this app needs, in one place.
 *
 * Access goes through `serverEnv()` rather than a module-level constant. That
 * is not ceremony: `next build` evaluates route modules to collect page data,
 * so a constant parsed at import time would make a production build demand
 * real secrets. Reading lazily keeps the build honest while
 * `instrumentation.ts` still forces the check at server startup, so a missing
 * variable crashes on boot, named, instead of on someone's first prompt.
 */
const serverEnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional().default(""),
  DATABASE_URL: z.string().optional().default(""),
  CLERK_SECRET_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .optional()
    .default("pk_test_Y2xlcmsuZXhhbXBsZS5jb20k"),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_POSTHOG_HOST: z
    .string()
    .optional()
    .default("https://us.i.posthog.com"),
  ARCJET_KEY: z.string().optional().default(""),
});

export type ServerEnv = Readonly<z.infer<typeof serverEnvSchema>>;

const formatIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

const parseServerEnv = (source: NodeJS.ProcessEnv): ServerEnv => {
  const result = serverEnvSchema.safeParse(source);

  if (!result.success) {
    throw new Error(
      `Invalid environment variables:\n${formatIssues(result.error)}\n\nCopy .env.example to .env.local and fill in the missing values.`,
    );
  }

  return Object.freeze(result.data);
};

let cached: ServerEnv | null = null;

/** Parses once, then hands back the same frozen object on every later call. */
export const serverEnv = (): ServerEnv => (cached ??= parseServerEnv(process.env));

export const hasClerkConfigured = (): boolean =>
  Boolean(serverEnv().CLERK_SECRET_KEY);
