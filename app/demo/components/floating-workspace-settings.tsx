"use client";

import { useEffect, useState } from "react";
import { Database, Info, User as UserIcon, Folder, Type } from "lucide-react";
import { useWorkspace } from "./workspace-context";
import { apiListWorkspaces } from "../api/workspace";

type MeResponse = { user: { username: string } | null };

type Props = {
  fontSize: number;
};

// Workspace パネル裏面の設定 / 情報ペイン。アクションは持たず、現在の状態を見せるだけ。
export function FloatingWorkspaceSettings({ fontSize }: Props) {
  const { workspace } = useWorkspace();
  const [username, setUsername] = useState<string | null>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<MeResponse>) : null))
      .then((j) => {
        if (!cancelled && j) setUsername(j.user?.username ?? null);
      })
      .catch(() => {});
    apiListWorkspaces()
      .then((list) => {
        if (!cancelled) setCount(list.length);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="flex-1 overflow-y-auto px-3 py-3 font-mono text-slate-600"
      style={{ fontSize }}
    >
      <Section title="App">
        <Row
          icon={<Info className="h-3 w-3" />}
          label="name"
          value="simple-workspace-demo"
        />
        <Row
          icon={<Info className="h-3 w-3" />}
          label="features"
          value="OpenCode (RAG vs Agentic) + 訪問介護レポート (整形 + Agentic ガイドライン照合)"
        />
      </Section>

      <Section title="Account">
        <Row
          icon={<UserIcon className="h-3 w-3" />}
          label="user"
          value={username ?? "(loading...)"}
        />
      </Section>

      <Section title="Workspace">
        <Row
          icon={<Folder className="h-3 w-3" />}
          label="current"
          value={workspace ? `${workspace.label} (${workspace.id})` : "(none)"}
        />
        <Row
          icon={<Folder className="h-3 w-3" />}
          label="registered"
          value={count === null ? "(loading...)" : `${count} 件`}
        />
      </Section>

      <Section title="Files">
        <Row
          icon={<Folder className="h-3 w-3" />}
          label="corpus/"
          value="社内文書 16 件 (workspace 作成 / 再 open 時に自動 seed)"
        />
        <Row
          icon={<Folder className="h-3 w-3" />}
          label="reports/"
          value="訪問介護レポート出力先。ツリー右の × で削除可能"
        />
      </Section>

      <Section title="UI">
        <Row
          icon={<Type className="h-3 w-3" />}
          label="font size"
          value={`${fontSize} px`}
        />
      </Section>

      <Section title="Storage">
        <Row
          icon={<Database className="h-3 w-3" />}
          label="db"
          value="SQLite (prisma/dev.db) via Prisma 7"
        />
        <Row
          icon={<Database className="h-3 w-3" />}
          label="files"
          value="WorkspaceFile (path 単位の仮想 FS)"
        />
        <Row
          icon={<Database className="h-3 w-3" />}
          label="limits"
          value="64KB / file, 100 files / workspace"
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-400">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span className="w-20 shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 flex-1 truncate text-slate-700">{value}</span>
    </div>
  );
}
