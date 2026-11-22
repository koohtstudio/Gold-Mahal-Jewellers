"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

/** A true or false flag kept for this browser tab only (sessionStorage). Used for dismissible banners. */
export function useSessionFlag(key: string): [boolean, (v: boolean) => void] {
  const sub = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => void listeners.delete(cb);
  }, []);
  const value = useSyncExternalStore(
    sub,
    () => {
      try {
        return window.sessionStorage.getItem(key) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const set = useCallback(
    (v: boolean) => {
      try {
        if (v) window.sessionStorage.setItem(key, "1");
        else window.sessionStorage.removeItem(key);
      } catch {
        /* ignore */
      }
      listeners.forEach((l) => l());
    },
    [key],
  );
  return [value, set];
}
