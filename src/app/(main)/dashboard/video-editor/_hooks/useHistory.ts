"use client";

import { useState, useCallback } from "react";

export function useHistory<T>(initial: T, maxHistory = 50) {
  const [history, setHistory] = useState({
    past: [] as T[],
    present: initial,
    future: [] as T[],
  });

  const push = useCallback((newPresent: T) => {
    setHistory((h) => ({
      past: [...h.past.slice(-(maxHistory - 1)), h.present],
      present: newPresent,
      future: [],
    }));
  }, [maxHistory]);

  const commit = useCallback((beforeState: T) => {
    setHistory((h) => ({
      past: [...h.past.slice(-(maxHistory - 1)), beforeState],
      present: h.present,
      future: [],
    }));
  }, [maxHistory]);

  const setState = useCallback((updater: T | ((prev: T) => T)) => {
    setHistory((h) => ({
      ...h,
      present: typeof updater === "function" ? (updater as (p: T) => T)(h.present) : updater,
    }));
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.past.length === 0) return h;
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (h.future.length === 0) return h;
      return {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      };
    });
  }, []);

  return {
    state: history.present,
    setState,
    push,
    commit,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
