import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { getUser } from "./user";
import { execShell, SandboxImageMissingError, type ShellSession } from "./docker";

export const SHELL_WS_PATH = "/api/shell/ws";

const HEARTBEAT_INTERVAL_MS = 30_000;

type ResizeMessage = { type: "resize"; cols: number; rows: number };

export type ShellWsHandler = {
  handleUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void>;
  close(): void;
};

export function createShellWsHandler(): ShellWsHandler {
  const wss = new WebSocketServer({ noServer: true });

  return {
    async handleUpgrade(req, socket, head) {
      try {
        if (!isSameOrigin(req)) {
          rejectUpgrade(socket, 403, "Forbidden");
          return;
        }
        const user = await getUser(req);
        if (!user) {
          rejectUpgrade(socket, 401, "Unauthorized");
          return;
        }
        wss.handleUpgrade(req, socket, head, (ws) => {
          attachSession(ws, user.id).catch((err: unknown) => {
            const msg =
              err instanceof SandboxImageMissingError
                ? err.message
                : "Failed to start sandbox shell";
            try {
              ws.send(`\r\n\x1b[31m${msg}\x1b[0m\r\n`);
            } catch {
              /* ignore */
            }
            ws.close(1011, "shell-attach-failed");
            console.error("[shell-ws] attach failed:", err);
          });
        });
      } catch (err) {
        console.error("[shell-ws] upgrade failed:", err);
        rejectUpgrade(socket, 500, "Internal Server Error");
      }
    },
    close() {
      wss.close();
    },
  };
}

function rejectUpgrade(socket: Duplex, status: number, reason: string): void {
  if (!socket.writable) {
    socket.destroy();
    return;
  }
  const body = `${status} ${reason}`;
  socket.write(
    [
      `HTTP/1.1 ${status} ${reason}`,
      "Connection: close",
      "Content-Type: text/plain; charset=utf-8",
      `Content-Length: ${Buffer.byteLength(body)}`,
      "",
      body,
    ].join("\r\n"),
  );
  socket.destroy();
}

function isSameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    // Origin が無い = ブラウザ以外。Cookie 認証で十分とみなす。
    return true;
  }
  const host = req.headers.host;
  if (!host) return false;
  try {
    const url = new URL(origin);
    return url.host === host;
  } catch {
    return false;
  }
}

async function attachSession(ws: WebSocket, userId: string): Promise<void> {
  let session: ShellSession | null = null;
  let closed = false;
  let alive = true;

  const cleanup = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    if (session) {
      try {
        session.stream.end();
      } catch {
        /* ignore */
      }
    }
    if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
  };

  const heartbeat = setInterval(() => {
    if (!alive) {
      ws.terminate();
      return;
    }
    alive = false;
    try {
      ws.ping();
    } catch {
      /* ignore */
    }
  }, HEARTBEAT_INTERVAL_MS);

  ws.on("pong", () => {
    alive = true;
  });

  ws.on("close", cleanup);
  ws.on("error", cleanup);

  try {
    session = await execShell(userId);
  } catch (err) {
    cleanup();
    throw err;
  }

  session.stream.on("data", (chunk: Buffer) => {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(chunk, { binary: true });
  });
  session.stream.on("end", cleanup);
  session.stream.on("close", cleanup);
  session.stream.on("error", cleanup);

  ws.on("message", (data, isBinary) => {
    if (!session) return;
    if (!isBinary) {
      const parsed = parseControlFrame(data);
      if (parsed) {
        session.resize(parsed.cols, parsed.rows).catch(() => {});
        return;
      }
    }
    const buf = toBuffer(data);
    if (buf.length === 0) return;
    session.stream.write(buf);
  });
}

function parseControlFrame(data: unknown): ResizeMessage | null {
  let text: string;
  if (typeof data === "string") {
    text = data;
  } else if (Buffer.isBuffer(data)) {
    text = data.toString("utf8");
  } else {
    return null;
  }
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as Partial<ResizeMessage>;
    if (
      parsed &&
      parsed.type === "resize" &&
      typeof parsed.cols === "number" &&
      typeof parsed.rows === "number"
    ) {
      return { type: "resize", cols: parsed.cols, rows: parsed.rows };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data.map((d) => toBuffer(d)));
  if (typeof data === "string") return Buffer.from(data, "utf8");
  return Buffer.alloc(0);
}
