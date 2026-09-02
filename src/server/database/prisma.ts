import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    transactionOptions: {
      maxWait: 10_000,
      timeout: 10_000,
    },
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
