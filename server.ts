import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { createShellWsHandler, SHELL_WS_PATH } from "./lib/shell-ws";

const port = Number(process.env.PORT ?? 3000);
const hostname = process.env.HOST ?? "127.0.0.1";
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev, hostname, port, turbopack: dev });

async function main(): Promise<void> {
  await app.prepare();
  const handle = app.getRequestHandler();
  const upgradeHandler = app.getUpgradeHandler();
  const shellWs = createShellWsHandler();

  const server = createServer((req, res) => {
    handle(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    if (url === SHELL_WS_PATH || url.startsWith(`${SHELL_WS_PATH}?`)) {
      void shellWs.handleUpgrade(req, socket, head);
      return;
    }
    upgradeHandler(req, socket, head);
  });

  server.listen(port, hostname, () => {
    console.log(
      `> Ready on http://${hostname}:${port}  (shell-ws: ${SHELL_WS_PATH})`,
    );
  });

  const shutdown = (): void => {
    shellWs.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
