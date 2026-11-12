import { PrismaClient } from "@/generated/prisma";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/// L'adresse de la base : DATABASE_URL, ou à défaut les noms que Vercel / Neon / Supabase posent eux-mêmes (voir lib/database-url.ts).
const databaseUrl = resolveDatabaseUrl();

export const prisma = globalForPrisma.prisma ?? new PrismaClient(databaseUrl ? { datasourceUrl: databaseUrl } : undefined);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
