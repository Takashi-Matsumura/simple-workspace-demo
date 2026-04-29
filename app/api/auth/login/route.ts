import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookieHeader, createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { ensureContainer } from "@/lib/docker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ログイン直後に「ユーザ専用 Docker コンテナ」を fire-and-forget で確保する。
// Docker 不調 (daemon 未起動 / image 未ビルド等) でもログイン自体は成功させる。
// 既存ユーザが再ログインしただけのときは ensureContainer が冪等に既存を返す。
function ensureUserContainer(userId: string): void {
  ensureContainer(userId, { networkMode: "bridge" }).catch((err: unknown) => {
    console.warn(
      `[auth] ensureContainer failed for user ${userId}:`,
      err instanceof Error ? err.message : err,
    );
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "ユーザ名とパスワードを入力してください" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json(
      { error: "ユーザ名またはパスワードが違います" },
      { status: 401 },
    );
  }

  const { cookieValue, expiresAt } = await createSession(user.id);
  ensureUserContainer(user.id);
  const res = NextResponse.json({ user: { id: user.id, username: user.username } });
  res.headers.set(
    "Set-Cookie",
    cookieHeader(SESSION_COOKIE, cookieValue, { expiresAt }),
  );
  return res;
}
