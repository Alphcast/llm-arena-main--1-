import "server-only";

import arcjet, { shield } from "@arcjet/next";

import { serverEnv } from "./env";

/**
 * The base Arcjet client, built on first use.
 *
 * Only Shield lives here: it is free, needs no configuration, and every route
 * wants it. Anything route-specific is layered on with `withRule()` at the
 * route, so one endpoint's rate limit never silently applies to another.
 *
 * Lazy for the same reason the Prisma and OpenRouter clients are: `next build`
 * evaluates route modules to collect page data, and a build should not demand
 * a real ARCJET_KEY.
 */
type ArcjetClientInstance = ReturnType<typeof arcjet>;

let cached: ArcjetClientInstance | null = null;

const createMockArcjetClient = (): ArcjetClientInstance => {
  const mock = {
    withRule: () => mock,
    protect: async () => ({
      isErrored: () => false,
      isDenied: () => false,
      reason: {
        isRateLimit: () => false,
        message: "",
        resetTime: undefined,
      },
    }),
  };
  return mock as unknown as ArcjetClientInstance;
};

const createArcjetClient = (): ArcjetClientInstance => {
  const key = serverEnv().ARCJET_KEY;
  if (!key || !key.startsWith("ajkey_")) {
    return createMockArcjetClient();
  }
  return arcjet({
    key,
    rules: [shield({ mode: "LIVE" })],
  });
};

export const arcjetClient = (): ArcjetClientInstance => (cached ??= createArcjetClient());
