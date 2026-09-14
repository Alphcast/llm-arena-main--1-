import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "./env";

/**
 * A single Prisma client for the whole server, created on first use.
 *
 * Next.js reloads modules on every edit in development, so without a cached
 * instance each save would open a fresh connection pool until Postgres refuses
 * new ones. The global cache exists only for that reason and is skipped in
 * production, where the module is evaluated once.
 *
 * Construction is lazy so that `next build`, which evaluates route modules to
 * collect page data, never needs a real DATABASE_URL.
 */
import { createInMemoryPrisma } from "./in-memory-db";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const createPrismaClient = (): PrismaClient => {
  const url = serverEnv().DATABASE_URL;
  if (!url || (!url.startsWith("postgres://") && !url.startsWith("postgresql://"))) {
    return createInMemoryPrisma();
  }

  try {
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  } catch (error) {
    console.warn("[database] Failed to initialize Prisma adapter, falling back to in-memory store", error);
    return createInMemoryPrisma();
  }
};

export const database = (): PrismaClient => {
  const client = globalForPrisma.prisma ?? createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }

  return client;
};
