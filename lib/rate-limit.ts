// 単一プロセス前提の in-memory fixed-window レート制限。
// PM2 cluster や水平スケールでは無効化される (各プロセスで Map が独立)。
// `npm run dev` 時はホットリロードで Map がクリアされる。
// 本デモは Mac Studio + Colima 単一プロセス運用なので、これで十分。

const WINDOW_SEC = 60;
const FAILURE_THRESHOLD = 5;
const LOCK_SEC = 15 * 60;

type Entry = {
  failCount: number;
  windowStart: number;
  lockedUntil?: number;
};

const store = new Map<string, Entry>();

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export type LockState = { locked: boolean; retryAfterSec?: number };

export function checkLocked(key: string): LockState {
  const e = store.get(key);
  if (!e?.lockedUntil) return { locked: false };
  const remaining = e.lockedUntil - nowSec();
  if (remaining <= 0) {
    store.delete(key);
    return { locked: false };
  }
  return { locked: true, retryAfterSec: remaining };
}

export function recordFailure(key: string): LockState {
  const t = nowSec();
  const e = store.get(key);
  if (e?.lockedUntil && e.lockedUntil > t) {
    return { locked: true, retryAfterSec: e.lockedUntil - t };
  }
  if (!e || t - e.windowStart >= WINDOW_SEC) {
    store.set(key, { failCount: 1, windowStart: t });
    return { locked: false };
  }
  e.failCount += 1;
  if (e.failCount >= FAILURE_THRESHOLD) {
    e.lockedUntil = t + LOCK_SEC;
    return { locked: true, retryAfterSec: LOCK_SEC };
  }
  return { locked: false };
}

export function recordSuccess(key: string): void {
  store.delete(key);
}

export function clientIpFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return "unknown";
}
