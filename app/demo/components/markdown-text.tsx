"use client";

import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  text: string;
  // ガイドライン照合後の本文ハイライト用。`**…**` を蛍光ペン風の
  // 黄色マーカー + 太字に切り替えて、確認すべき箇所を視覚的に強調する。
  highlightStrong?: boolean;
};

// LLM が回答に埋め込む `[doc=xxx]` を、特殊な hash リンク `#doc/xxx` を持つ
// Markdown リンクに置き換える。後段で <a> をボタン化し、クリックで Workspace
// パネルにファイルを開かせる。
function preprocessDocRefs(input: string): string {
  return input.replace(/\[doc=([a-zA-Z0-9_\-.]+)\]/g, "[doc=$1](#doc/$1)");
}

// `workspace:open-doc` イベントのディスパッチ用 (id は corpus 上の doc id)。
// 受け側は floating-workspace.tsx でリスンして selectedPath をセットする。
export const OPEN_DOC_EVENT = "workspace:open-doc";
export type OpenDocEventDetail = { id: string };

// `workspace:open-path` は仮想 FS の path を直接指定して開くイベント。
// レポート整形パネルなど、corpus id を持たない外部から workspace ツリーに
// ファイルを反映 + 自動選択させる用途で使う。
export const OPEN_PATH_EVENT = "workspace:open-path";
export type OpenPathEventDetail = { path: string };

// LLM 回答用の軽量 Markdown レンダラ。
// @tailwindcss/typography に依存せず、必要なタグだけ手書きで色付けする。
export function MarkdownText({ text, highlightStrong = false }: Props) {
  return (
    <div className="space-y-2 leading-relaxed text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="whitespace-pre-wrap">{children}</p>
          ),
          h1: ({ children }) => (
            <h1 className="mt-2 text-base font-bold text-slate-900">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-2 text-[1em] font-bold text-slate-900">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-1.5 font-semibold text-slate-900">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-0.5 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-0.5 pl-5">{children}</ol>
          ),
          strong: ({ children }) =>
            highlightStrong ? (
              <HighlightMark>{children}</HighlightMark>
            ) : (
              <strong className="font-semibold text-slate-900">
                {children}
              </strong>
            ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => {
            // `#doc/xxx` 形式のリンクは引用ピン。クリックで workspace パネルに
            // 該当ファイルを開かせる (実際のナビゲーションは抑止)。
            if (href?.startsWith("#doc/")) {
              const id = href.slice("#doc/".length);
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.dispatchEvent(
                      new CustomEvent<OpenDocEventDetail>(OPEN_DOC_EVENT, {
                        detail: { id },
                      }),
                    );
                  }}
                  title="Workspace パネルでこの文書を開く"
                  className="cursor-pointer rounded border border-blue-200 bg-blue-50 px-1 font-mono text-blue-700 hover:bg-blue-100"
                >
                  {children}
                </button>
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-700"
              >
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-slate-300 pl-2 italic text-slate-600">
              {children}
            </blockquote>
          ),
          // 親 <pre> 配下の <code> は背景・パディングを打ち消し、フェンスドコードブロックとして見せる
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded bg-slate-100 p-2 font-mono text-[0.9em] text-slate-800 [&>code]:bg-transparent [&>code]:p-0">
              {children}
            </pre>
          ),
          code: ({ children, ...props }) => (
            <code
              className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-800"
              {...props}
            >
              {children}
            </code>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="border-collapse text-[0.9em]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-slate-300 bg-slate-100 px-2 py-1 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-slate-300 px-2 py-1">{children}</td>
          ),
          hr: () => <hr className="my-2 border-slate-200" />,
        }}
      >
        {preprocessDocRefs(text)}
      </ReactMarkdown>
    </div>
  );
}

// 太字の先頭が `[N] ` の場合は番号バッジを切り出して描画する。
// これで本文中のハイライトとサマリ事項を同じ番号で視覚的につなげられる。
function HighlightMark({ children }: { children?: ReactNode }) {
  const arr = Children.toArray(children);
  let badge: string | null = null;
  let rest: ReactNode = children;
  if (arr.length > 0 && typeof arr[0] === "string") {
    const m = arr[0].match(/^\[(\d+)\]\s+([\s\S]*)$/);
    if (m) {
      badge = m[1];
      rest = [m[2], ...arr.slice(1)] as ReactNode[];
    }
  }
  return (
    <mark
      className="rounded bg-yellow-200 px-1 py-0.5 font-semibold text-slate-900"
      style={{ boxShadow: "0 0 0 1px rgba(202, 138, 4, 0.25)" }}
      title="人間の確認が必要な箇所 (Step 2 で抽出)"
    >
      {badge && (
        <span className="mr-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-600 px-1 align-[1px] text-[10px] font-bold leading-none text-white">
          {badge}
        </span>
      )}
      {rest}
    </mark>
  );
}
