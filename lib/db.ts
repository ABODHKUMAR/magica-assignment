// Prisma client singleton. Only instantiated when DATABASE_URL is present.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const prisma: PrismaClient | null = hasDatabase
  ? globalForPrisma.prisma ?? new PrismaClient()
  : null;

if (hasDatabase && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma!;
}
