// Sandbox コンテナのリソース上限を env から解釈する。
// 未指定 / パース失敗時はハードコード既定にフォールバック。

export type SandboxLimits = {
  NanoCpus: number;
  Memory: number;
  PidsLimit: number;
};

const DEFAULT_CPUS = 1.0;
const DEFAULT_MEMORY_BYTES = 1024 * 1024 * 1024; // 1 GiB
const DEFAULT_PIDS = 256;

function parseCpus(raw: string | undefined): number {
  if (!raw) return DEFAULT_CPUS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CPUS;
  return n;
}

function parseMemory(raw: string | undefined): number {
  if (!raw) return DEFAULT_MEMORY_BYTES;
  const m = raw.trim().match(/^(\d+(?:\.\d+)?)\s*([kmg]?)b?$/i);
  if (!m) return DEFAULT_MEMORY_BYTES;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MEMORY_BYTES;
  const mult: Record<string, number> = {
    "": 1,
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024,
  };
  return Math.floor(n * mult[m[2].toLowerCase()]);
}

function parsePids(raw: string | undefined): number {
  if (!raw) return DEFAULT_PIDS;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return DEFAULT_PIDS;
  return n;
}

export function readSandboxLimits(): SandboxLimits {
  return {
    NanoCpus: Math.floor(parseCpus(process.env.SANDBOX_CPUS) * 1_000_000_000),
    Memory: parseMemory(process.env.SANDBOX_MEMORY),
    PidsLimit: parsePids(process.env.SANDBOX_PIDS),
  };
}
