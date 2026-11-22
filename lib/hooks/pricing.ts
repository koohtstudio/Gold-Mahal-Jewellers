"use client";

import { useMemo } from "react";
import type { Piece } from "@/lib/domain/schemas";
import { allRates, priceOf } from "@/lib/pricing";
import { useRate, useSettings } from "./index";

/** Today's rate and the price function every screen uses. When the owner publishes a new rate, everything here moves. */
export function usePricing() {
  const rate = useRate().data;
  const settings = useSettings().data;
  return useMemo(() => {
    const rate24 = rate?.rate24Cents ?? 20800;
    const barPremiumBps = Math.round((settings?.barPremiumPct ?? 2) * 100);
    return {
      rate,
      settings,
      rate24,
      rates: allRates(rate24),
      barPremiumBps,
      price: (p: Piece) => priceOf(p, rate24, { barPremiumBps }),
    };
  }, [rate, settings]);
}
