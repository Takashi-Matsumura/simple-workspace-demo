import {
  ApiErrorSchema,
  CreateWorkspaceResponseSchema,
  ListWorkspacesResponseSchema,
} from "@/lib/api-schemas";

export type WorkspaceListEntry = {
  id: string;
  label: string;
  createdAt: number;
  lastOpenedAt: number;
};

async function readError(res: Response): Promise<string> {
  const body = ApiErrorSchema.safeParse(await res.json().catch(() => ({})));
  return body.success ? (body.data.error ?? `HTTP ${res.status}`) : `HTTP ${res.status}`;
}

export async function apiListWorkspaces(): Promise<WorkspaceListEntry[]> {
  const res = await fetch("/api/user/workspaces", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = ListWorkspacesResponseSchema.parse(await res.json());
  return data.workspaces;
}

export async function apiCreateWorkspace(label: string): Promise<WorkspaceListEntry> {
  const res = await fetch("/api/user/workspaces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });
  const parsed = CreateWorkspaceResponseSchema.safeParse(await res.json().catch(() => ({})));
  const data = parsed.success ? parsed.data : {};
  if (!res.ok || !data.workspace) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data.workspace;
}

export async function apiDeleteWorkspace(id: string): Promise<void> {
  const res = await fetch(`/api/user/workspaces?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await readError(res));
}

export async function apiTouchWorkspace(id: string): Promise<void> {
  const res = await fetch("/api/user/workspaces", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
