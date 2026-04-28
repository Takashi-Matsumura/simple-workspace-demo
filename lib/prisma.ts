import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// next dev の HMR で接続がリークしないようグローバルにキャッシュする (開発時のみ)。
declare global {
  var __prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient = global.__prisma__ ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma__ = prisma;
}
