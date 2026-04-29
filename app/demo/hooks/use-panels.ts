"use client";

import { useCallback, useReducer } from "react";
import {
  INITIAL_PANEL_ORDER,
  type PanelId,
  type TerminalPanelId,
} from "../types/panels";
import type { TerminalSession } from "../components/floating-terminal";
import type { Workspace } from "../components/floating-workspace";

export type PanelsState = {
  sessions: Map<TerminalPanelId, TerminalSession>;
  shellOpen: boolean;
  order: PanelId[]; // 末尾 = 最前面
};

export type PanelsAction =
  | {
      type: "open_terminal";
      id: TerminalPanelId;
      workspace: Workspace;
      nonce: number;
    }
  | { type: "close_terminal"; id: TerminalPanelId }
  | { type: "open_shell" }
  | { type: "close_shell" }
  | { type: "bring_to_front"; id: PanelId }
  | { type: "clear_terminal_sessions" };

const INITIAL_STATE: PanelsState = {
  sessions: new Map(),
  shellOpen: false,
  order: [...INITIAL_PANEL_ORDER],
};

function moveToFront(order: PanelId[], id: PanelId): PanelId[] {
  if (order[order.length - 1] === id) return order;
  return [...order.filter((p) => p !== id), id];
}

export function panelsReducer(state: PanelsState, action: PanelsAction): PanelsState {
  switch (action.type) {
    case "open_terminal": {
      const sessions = new Map(state.sessions);
      sessions.set(action.id, {
        workspaceId: action.workspace.id,
        nonce: action.nonce,
      });
      return {
        ...state,
        sessions,
        order: moveToFront(state.order, action.id),
      };
    }
    case "close_terminal": {
      if (!state.sessions.has(action.id)) return state;
      const sessions = new Map(state.sessions);
      sessions.delete(action.id);
      return { ...state, sessions };
    }
    case "open_shell": {
      return {
        ...state,
        shellOpen: true,
        order: moveToFront(state.order, "shell"),
      };
    }
    case "close_shell": {
      if (!state.shellOpen) return state;
      return { ...state, shellOpen: false };
    }
    case "bring_to_front": {
      const next = moveToFront(state.order, action.id);
      if (next === state.order) return state;
      return { ...state, order: next };
    }
    case "clear_terminal_sessions": {
      if (state.sessions.size === 0) return state;
      return { ...state, sessions: new Map() };
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function usePanels(): {
  sessions: ReadonlyMap<TerminalPanelId, TerminalSession>;
  shellOpen: boolean;
  order: readonly PanelId[];
  frontPanel: PanelId;
  zFor: (id: PanelId) => number;
  openTerminal: (id: TerminalPanelId, workspace: Workspace) => void;
  closeTerminal: (id: TerminalPanelId) => void;
  openShell: () => void;
  closeShell: () => void;
  bringToFront: (id: PanelId) => void;
  clearTerminalSessions: () => void;
} {
  const [state, dispatch] = useReducer(panelsReducer, INITIAL_STATE);

  const openTerminal = useCallback((id: TerminalPanelId, workspace: Workspace) => {
    dispatch({ type: "open_terminal", id, workspace, nonce: Date.now() });
  }, []);

  const closeTerminal = useCallback((id: TerminalPanelId) => {
    dispatch({ type: "close_terminal", id });
  }, []);

  const openShell = useCallback(() => {
    dispatch({ type: "open_shell" });
  }, []);

  const closeShell = useCallback(() => {
    dispatch({ type: "close_shell" });
  }, []);

  const bringToFront = useCallback((id: PanelId) => {
    dispatch({ type: "bring_to_front", id });
  }, []);

  const clearTerminalSessions = useCallback(() => {
    dispatch({ type: "clear_terminal_sessions" });
  }, []);

  // zIndex は 40 起点、末尾ほど手前。footer (z-[60]) より下に収める。
  const zFor = useCallback(
    (id: PanelId): number => 40 + state.order.indexOf(id),
    [state.order],
  );

  const frontPanel = state.order[state.order.length - 1];

  return {
    sessions: state.sessions,
    shellOpen: state.shellOpen,
    order: state.order,
    frontPanel,
    zFor,
    openTerminal,
    closeTerminal,
    openShell,
    closeShell,
    bringToFront,
    clearTerminalSessions,
  };
}
