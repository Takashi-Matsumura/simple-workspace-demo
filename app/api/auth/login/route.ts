import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookieHeader, createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { ensureContainer } from "@/lib/docker";
import {
  checkLocked,
  clientIpFromRequest,
  recordFailure,
  recordSuccess,
} from "@/lib/rate-limit";

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

function tooManyAttempts(retryAfterSec: number): NextResponse {
  const res = NextResponse.json(
    { error: "試行回数が多すぎます。しばらく時間をおいて再度お試しください" },
    { status: 429 },
  );
  res.headers.set("Retry-After", String(retryAfterSec));
  return res;
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

  const rateKey = `login:${clientIpFromRequest(request)}:${username.toLowerCase()}`;
  const locked = checkLocked(rateKey);
  if (locked.locked) return tooManyAttempts(locked.retryAfterSec ?? 60);

  const user = await prisma.user.findUnique({ where: { username } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    const after = recordFailure(rateKey);
    if (after.locked) return tooManyAttempts(after.retryAfterSec ?? 60);
    return NextResponse.json(
      { error: "ユーザ名またはパスワードが違います" },
      { status: 401 },
    );
  }

  recordSuccess(rateKey);
  const { cookieValue, expiresAt } = await createSession(user.id);
  ensureUserContainer(user.id);
  const res = NextResponse.json({ user: { id: user.id, username: user.username } });
  res.headers.set(
    "Set-Cookie",
    cookieHeader(SESSION_COOKIE, cookieValue, { expiresAt }),
  );
  return res;
}
