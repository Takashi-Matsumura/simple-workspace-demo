import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// LLM バックエンド。デフォルトはローカル llama.cpp (OpenAI 互換 API)。
// 環境変数で別の OpenAI 互換エンドポイントに差し替えられる。
//   LLAMA_BASE_URL  http://host:port/v1
//   LLAMA_MODEL     モデル名 (例: gemma)
//   LLAMA_API_KEY   API キー (llama.cpp ではダミー値で OK)
const baseURL = process.env.LLAMA_BASE_URL ?? "http://localhost:8080/v1";
const modelName = process.env.LLAMA_MODEL ?? "gemma";

const llama = createOpenAICompatible({
  name: "llama",
  baseURL,
  apiKey: process.env.LLAMA_API_KEY ?? "not-needed",
});

export const localModel = llama.chatModel(modelName);
