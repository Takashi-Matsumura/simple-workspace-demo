"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "sandbox-enabled";

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (ev: StorageEvent): void => {
    if (ev.key === STORAGE_KEY || ev.key === null) onChange();
  };
  window.addEventListener("storage", handler);
  window.addEventListener("sandbox-toggle-change", onChange);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("sandbox-toggle-change", onChange);
  };
}

export function useSandboxToggle(): {
  enabled: boolean;
  setEnabled: (next: boolean) => void;
  toggle: () => void;
} {
  // SSR では false 固定。マウント後は localStorage を真値とする。
  const enabled = useSyncExternalStore(
    subscribe,
    read,
    () => false,
  );

  const setEnabled = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    // 同一タブ内に変更を通知する (storage イベントは別タブにしか飛ばないため)。
    window.dispatchEvent(new Event("sandbox-toggle-change"));
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!enabled);
  }, [enabled, setEnabled]);

  return { enabled, setEnabled, toggle };
}
