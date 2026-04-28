import { z } from "zod";

// ===== Workspace API =====

export const WorkspaceListEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.number(),
  lastOpenedAt: z.number(),
});

export const ListWorkspacesResponseSchema = z.object({
  workspaces: z.array(WorkspaceListEntrySchema),
});

export const CreateWorkspaceResponseSchema = z.object({
  workspace: WorkspaceListEntrySchema.optional(),
  error: z.string().optional(),
});

// ===== 共通: error フィールドのみ拾う =====

export const ApiErrorSchema = z.object({
  error: z.string().optional(),
});
