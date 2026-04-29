import type { UIMessage } from "ai";

export type RetrievedHit = {
  id: string;
  title: string;
  category: "spec" | "faq" | "incident";
  snippet: string;
  score: number;
};

export type OpencodeMode = "rag" | "agentic";

export type OpencodeMetadata =
  | { mode: "rag"; retrieved: RetrievedHit[] }
  | { mode: "agentic" };

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
