import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookieHeader, createSession, hashPassword, SESSION_COOKIE } from "@/lib/auth";
import { ensureContainer } from "@/lib/docker";
import {
  checkLocked,
  clientIpFromRequest,
  recordFailure,
  recordSuccess,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

function ensureUserContainer(userId: string): void {
  ensureContainer(userId, { networkMode: "none" }).catch((err: unknown) => {
    console.warn(
      `[auth] ensureContainer failed for user ${userId}:`,
      err instanceof Error ? err.message : err,
    );
  });
}

function registrationAllowed(): boolean {
  return process.env.ALLOW_REGISTRATION === "true";
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
  if (!registrationAllowed()) {
    return NextResponse.json(
      { error: "新規登録は現在受け付けていません" },
      { status: 403 },
    );
  }

  const rateKey = `register:${clientIpFromRequest(request)}`;
  const locked = checkLocked(rateKey);
  if (locked.locked) return tooManyAttempts(locked.retryAfterSec ?? 60);

  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const username = (body.username ?? "").trim();
  const password = body.password ?? "";

  const fail = (status: number, error: string): NextResponse => {
    const after = recordFailure(rateKey);
    if (after.locked) return tooManyAttempts(after.retryAfterSec ?? 60);
    return NextResponse.json({ error }, { status });
  };

  if (!USERNAME_RE.test(username)) {
    return fail(400, "ユーザ名は 3〜32 文字の英数字 / _ . - のみ使用できます");
  }
  if (password.length < 4 || password.length > 12) {
    return fail(400, "パスワードは 4〜12 文字で指定してください");
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return fail(409, "このユーザ名は既に使用されています");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { username, passwordHash } });
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
