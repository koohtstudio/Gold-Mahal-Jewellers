"use client";

import { useSyncExternalStore } from "react";
import { BAG_KEY } from "@/lib/config";

export interface BagItem {
  pieceId: string;
  option: string;
  qty: number;
}

/** The reserve bag. Lives in localStorage on this device only. It is the one thing a visitor stores, and it is not a cookie. */
const listeners = new Set<() => void>();
let cache: BagItem[] = [];
let loaded = false;
const EMPTY: BagItem[] = [];

function load(): BagItem[] {
  try {
    const raw = window.localStorage.getItem(BAG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is BagItem => !!x && typeof x.pieceId === "string" && typeof x.option === "string" && Number.isInteger(x.qty) && x.qty > 0 && x.qty <= 20);
  } catch {
    return [];
  }
}

function snapshot(): BagItem[] {
  if (!loaded) {
    cache = load();
    loaded = true;
  }
  return cache;
}

function commit(next: BagItem[]) {
  cache = next;
  try {
    window.localStorage.setItem(BAG_KEY, JSON.stringify(next));
  } catch {
    /* the bag still works for this visit */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === BAG_KEY) {
      cache = load();
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const bag = {
  add(pieceId: string, option: string, qty = 1) {
    const cur = snapshot();
    const i = cur.findIndex((b) => b.pieceId === pieceId && b.option === option);
    commit(i > -1 ? cur.map((b, j) => (j === i ? { ...b, qty: Math.min(20, b.qty + qty) } : b)) : [...cur, { pieceId, option, qty }]);
  },
  change(index: number, delta: number) {
    commit(snapshot().map((b, j) => (j === index ? { ...b, qty: b.qty + delta } : b)).filter((b) => b.qty > 0));
  },
  remove(pieceId: string, option: string) {
    commit(snapshot().filter((b) => !(b.pieceId === pieceId && b.option === option)));
  },
  clear() {
    commit([]);
  },
};

export function useBag(): BagItem[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
