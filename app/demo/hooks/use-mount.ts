"use client";

import { useEffect } from "react";

// 初回マウント時に 1 回だけ callback を実行する。useEffect を直接書いた時の
// react-hooks/set-state-in-effect 警告を避けつつ、意図を明確にするヘルパ。
export function useMount(callback: () => void | (() => void)): void {
  useEffect(() => {
    return callback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
