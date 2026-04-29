import { NextResponse, type NextRequest } from "next/server";
import {
  cookieHeader,
  destroySessionByCookie,
  parseCookie,
  resolveSessionCookie,
  SESSION_COOKIE,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stopContainer } from "@/lib/docker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 同ユーザの他セッションが無ければコンテナを停止する。
// 「同じユーザが別ブラウザでログイン中」の場合に勝手に止めると WS 接続も
// 切れてしまうので、残セッション数で判定する。
async function maybeStopForUser(userId: string): Promise<void> {
  try {
    const remaining = await prisma.session.count({ where: { userId } });
    if (remaining > 0) return;
    await stopContainer(userId);
  } catch (err) {
    console.warn(
      `[auth/logout] stopContainer failed for user ${userId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

export async function POST(request: NextRequest) {
  const raw = parseCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (raw) {
    // 削除前に userId を解決しておく (削除後は引けなくなる)。
    const user = await resolveSessionCookie(raw);
    await destroySessionByCookie(raw);
    if (user) {
      // fire-and-forget: ログアウトレスポンスはコンテナ停止を待たない。
      void maybeStopForUser(user.id);
    }
  }
  const res = NextResponse.json({ ok: true });
  res.headers.set(
    "Set-Cookie",
    cookieHeader(SESSION_COOKIE, "", { clear: true }),
  );
  return res;
}
