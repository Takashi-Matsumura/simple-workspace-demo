"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  text: string;
};

// LLM 回答用の軽量 Markdown レンダラ。
// @tailwindcss/typography に依存せず、必要なタグだけ手書きで色付けする。
export function MarkdownText({ text }: Props) {
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
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-700"
            >
              {children}
            </a>
          ),
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
        {text}
      </ReactMarkdown>
    </div>
  );
}
