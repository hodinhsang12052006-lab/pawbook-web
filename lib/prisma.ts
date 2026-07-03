import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaInstance: PrismaClient;

// Use Turso LibSQL adapter if environment variables are provided
if (process.env.TURSO_DATABASE_URL) {
  const libsql = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql as any);
  prismaInstance = new PrismaClient({ adapter: adapter as any });
} else {
  // Otherwise fall back to local sqlite dev.db file database
  prismaInstance = new PrismaClient();
}

export const prisma = globalForPrisma.prisma || prismaInstance;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
export default prisma;
