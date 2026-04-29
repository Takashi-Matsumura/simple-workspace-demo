import type { UIMessage } from "ai";

export type RetrievedHit = {
  id: string;
  title: string;
  category: "spec" | "faq" | "incident" | "guideline";
  snippet: string;
  score: number;
};

export type OpencodeMode = "rag" | "agentic";

export type OpencodeMetadata =
  | { mode: "rag"; retrieved: RetrievedHit[] }
  | { mode: "agentic" }
  | { mode: "guideline-check" };

export type OpencodeUIMessage = UIMessage<OpencodeMetadata>;

export type SearchDocsPart = {
  type: "tool-searchDocs";
  state: string;
  input?: { query: string };
  output?: {
    query: string;
    hits: RetrievedHit[];
  };
};

export type ReadDocPart = {
  type: "tool-readDoc";
  state: string;
  input?: { id: string };
  output?:
    | { id: string; found: false }
    | {
        id: string;
        found: true;
        title: string;
        category: string;
        content: string;
      };
};

export type WorkspaceFileSummary = {
  path: string;
  size: number;
  updatedAt: string;
};

export type ListFilesPart = {
  type: "tool-listFiles";
  state: string;
  input?: { prefix?: string };
  output?:
    | { ok: true; files: WorkspaceFileSummary[] }
    | { ok: false; error: string };
};

export type ReadFilePart = {
  type: "tool-readFile";
  state: string;
  input?: { path: string };
  output?:
    | { ok: true; found: false }
    | { ok: true; found: true; path: string; content: string; updatedAt: string }
    | { ok: false; error: string };
};

export type WriteFilePart = {
  type: "tool-writeFile";
  state: string;
  input?: { path: string; content: string };
  output?:
    | { ok: true; path: string; size: number; created: boolean }
    | { ok: false; error: string };
};

export type DeleteFilePart = {
  type: "tool-deleteFile";
  state: string;
  input?: { path: string };
  output?:
    | { ok: true; path: string; deleted: boolean }
    | { ok: false; error: string };
};

// 訪問レポートの Step 2 (ガイドライン照合) で使う Agentic ツールの part 型。
export type GuidelineHit = {
  id: string;
  title: string;
  snippet: string;
  score: number;
};

export type SearchGuidelinesPart = {
  type: "tool-searchGuidelines";
  state: string;
  input?: { query: string };
  output?: { query: string; hits: GuidelineHit[] };
};

export type ReadGuidelinePart = {
  type: "tool-readGuideline";
  state: string;
  input?: { id: string };
  output?:
    | { id: string; found: false }
    | { id: string; found: true; title: string; content: string };
};
