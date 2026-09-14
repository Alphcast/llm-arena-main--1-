/**
 * Runs once when the server starts.
 *
 * The only job here is to force the environment check so a missing or
 * malformed variable crashes the process on boot, named, instead of surfacing
 * later as a confusing failure on someone's first prompt.
 */
export const register = async (): Promise<void> => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { serverEnv } = await import("./infrastructure/env");
  const env = serverEnv();
  if (!env.DATABASE_URL) {
    console.warn("[LLM Arena] DATABASE_URL not set — in-memory persistence active");
  }
  if (!env.OPENROUTER_API_KEY) {
    console.warn("[LLM Arena] OPENROUTER_API_KEY not set — configure in Settings to enable model racing");
  }
};
