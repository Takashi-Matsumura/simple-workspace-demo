import Docker from "dockerode";
import type { Duplex } from "node:stream";
import { sanitizeSub } from "./user";

const SOCKET_PATH = process.env.SANDBOX_DOCKER_SOCKET ?? "/var/run/docker.sock";
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "simple-workspace-sandbox:dev";

// Docker Desktop のグルーピング (Compose 互換ラベル)。これを付けるとアプリが
// 作る container / volume が "simple-workspace-demo" プロジェクトとして 1 つに
// 折りたたまれる。
const COMPOSE_PROJECT = "simple-workspace-demo";
const COMPOSE_SERVICE_CONTAINER = "user-shell";
const COMPOSE_SERVICE_VOLUME = "user-data";

const APP_LABEL = "simple-workspace-demo";
const KIND_LABEL = "shell";

export type NetworkMode = "none" | "bridge";

let cachedClient: Docker | null = null;
function client(): Docker {
  if (!cachedClient) cachedClient = new Docker({ socketPath: SOCKET_PATH });
  return cachedClient;
}

function names(userId: string): {
  container: string;
  volume: string;
} {
  const safe = sanitizeSub(userId);
  return {
    container: `simple-workspace-shell-${safe}`,
    volume: `simple-workspace-data-${safe}`,
  };
}

function containerLabels(userId: string, mode: NetworkMode): Record<string, string> {
  return {
    app: APP_LABEL,
    "simple-workspace.user": userId,
    "simple-workspace.kind": KIND_LABEL,
    "simple-workspace.network": mode,
    "com.docker.compose.project": COMPOSE_PROJECT,
    "com.docker.compose.service": COMPOSE_SERVICE_CONTAINER,
  };
}

function volumeLabels(userId: string): Record<string, string> {
  return {
    app: APP_LABEL,
    "simple-workspace.user": userId,
    "com.docker.compose.project": COMPOSE_PROJECT,
    "com.docker.compose.service": COMPOSE_SERVICE_VOLUME,
  };
}

export class SandboxImageMissingError extends Error {
  constructor() {
    super(
      `Sandbox image '${SANDBOX_IMAGE}' is not available. Run \`npm run sandbox:build\` first.`,
    );
    this.name = "SandboxImageMissingError";
  }
}

function isStatus(err: unknown, code: number): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { statusCode?: number }).statusCode === code
  );
}

function looksLikeNotFound(err: unknown): boolean {
  if (isStatus(err, 404)) return true;
  if (typeof err === "object" && err !== null) {
    const msg = (err as { message?: string }).message ?? "";
    return /no such (image|container|volume)/i.test(msg);
  }
  return false;
}

export async function ensureImage(): Promise<void> {
  try {
    await client().getImage(SANDBOX_IMAGE).inspect();
  } catch (err) {
    if (looksLikeNotFound(err)) throw new SandboxImageMissingError();
    throw err;
  }
}

async function findContainer(userId: string): Promise<Docker.ContainerInfo | null> {
  const filters = JSON.stringify({
    label: [
      `app=${APP_LABEL}`,
      `simple-workspace.user=${userId}`,
      `simple-workspace.kind=${KIND_LABEL}`,
    ],
  });
  const list = await client().listContainers({ all: true, filters });
  return list[0] ?? null;
}

async function ensureVolume(userId: string): Promise<string> {
  const { volume } = names(userId);
  try {
    await client().getVolume(volume).inspect();
  } catch (err) {
    if (!looksLikeNotFound(err)) throw err;
    await client().createVolume({ Name: volume, Labels: volumeLabels(userId) });
  }
  return volume;
}

export type ContainerStatus = "running" | "stopped" | "absent";

export type ShellInfo = {
  status: ContainerStatus;
  networkMode: NetworkMode | null;
  containerName: string | null;
};

function readNetworkLabel(info: Docker.ContainerInfo): NetworkMode {
  const v = info.Labels?.["simple-workspace.network"];
  return v === "none" ? "none" : "bridge";
}

export async function getInfo(userId: string): Promise<ShellInfo> {
  const info = await findContainer(userId);
  if (!info) {
    return { status: "absent", networkMode: null, containerName: null };
  }
  return {
    status: info.State === "running" ? "running" : "stopped",
    networkMode: readNetworkLabel(info),
    containerName: info.Names?.[0]?.replace(/^\//, "") ?? null,
  };
}

export async function ensureContainer(
  userId: string,
  options: { networkMode?: NetworkMode } = {},
): Promise<Docker.Container> {
  const desiredMode: NetworkMode = options.networkMode ?? "bridge";
  await ensureImage();
  const info = await findContainer(userId);
  if (info) {
    const c = client().getContainer(info.Id);
    if (info.State !== "running") {
      try {
        await c.start();
      } catch (err) {
        if (!isStatus(err, 304)) throw err;
      }
    }
    return c;
  }
  const { container: cname, volume: vname } = names(userId);
  await ensureVolume(userId);
  const c = await client().createContainer({
    name: cname,
    Image: SANDBOX_IMAGE,
    Tty: true,
    OpenStdin: true,
    Labels: containerLabels(userId, desiredMode),
    WorkingDir: "/root",
    Cmd: ["sleep", "infinity"],
    Env: ["TERM=xterm-256color", "LANG=en_US.UTF-8"],
    HostConfig: {
      Binds: [`${vname}:/root`],
      AutoRemove: false,
      RestartPolicy: { Name: "no" },
      NetworkMode: desiredMode,
    },
  });
  await c.start();
  return c;
}

// 既存があれば force remove → 指定 mode で再作成。Volume はそのまま。
export async function recreateContainer(
  userId: string,
  options: { networkMode: NetworkMode },
): Promise<Docker.Container> {
  await removeContainer(userId, { force: true });
  return ensureContainer(userId, options);
}

export async function removeContainer(
  userId: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const info = await findContainer(userId);
  if (!info) return;
  await client()
    .getContainer(info.Id)
    .remove({ force: options.force ?? true });
}

// 既存コンテナを stop。次回ログインで ensureContainer が start し直す。
// Volume は触らないので作業内容は維持される。既に停止 / 不在ならノーオペ。
export async function stopContainer(
  userId: string,
  options: { timeoutSec?: number } = {},
): Promise<void> {
  const info = await findContainer(userId);
  if (!info) return;
  if (info.State !== "running") return;
  try {
    await client()
      .getContainer(info.Id)
      .stop({ t: options.timeoutSec ?? 5 });
  } catch (err) {
    // 304 Not Modified = 既に停止済み。それ以外は再 throw。
    if (!isStatus(err, 304)) throw err;
  }
}

export type ShellSession = {
  exec: Docker.Exec;
  stream: Duplex;
  resize(cols: number, rows: number): Promise<void>;
};

export async function execShell(
  userId: string,
  initialSize?: { cols: number; rows: number },
): Promise<ShellSession> {
  const c = await ensureContainer(userId);
  const exec = await c.exec({
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
    Cmd: ["bash", "-l"],
    Env: ["TERM=xterm-256color", "LANG=en_US.UTF-8"],
    WorkingDir: "/root",
  });
  const stream = await exec.start({ hijack: true, stdin: true });
  const resize = async (cols: number, rows: number): Promise<void> => {
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) return;
    if (cols <= 0 || rows <= 0) return;
    await exec.resize({ w: Math.floor(cols), h: Math.floor(rows) });
  };
  if (initialSize) {
    await resize(initialSize.cols, initialSize.rows).catch(() => {});
  }
  return { exec, stream, resize };
}

export { SANDBOX_IMAGE, SOCKET_PATH };
