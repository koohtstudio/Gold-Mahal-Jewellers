import type { AccountantSettings, Settings } from "@/lib/domain/schemas";

export function defaultSettings(): Settings {
  const tue: { open: number; close: number } = { open: 11 * 60 + 30, close: 19 * 60 };
  const fri: { open: number; close: number } = { open: 11 * 60 + 30, close: 19 * 60 + 30 };
  return {
    acceptOrders: true,
    holdHours: 48,
    lockRate: true,
    sameDay: true,
    hours: { sun: { open: 11 * 60, close: 19 * 60 + 30 }, mon: null, tue, wed: { ...tue }, thu: { ...tue }, fri, sat: { ...fri } },
    readyText: "Your Gold Mahal reservation is ready. Show code {code} at the counter.",
    expiryText: "Your hold on {item} ends tomorrow. Reply to extend it.",
    buyRatePct: 94,
    barPremiumPct: 2,
    defaultMakingBps: { Earrings: 1000, Chains: 500, Bridal: 800, Diamonds: 1200, Bars: 200 },
    morningSuggestion: true,
    showUpdatedAt: true,
    showRateOnSite: true,
    textOnNew: true,
    slotCapacity: 3,
  };
}

/** A placeholder, not a real person or firm. The owner types the real details in admin. */
export function defaultAccountant(): AccountantSettings {
  return { name: "Sam Accountant", email: "accountant@example.com", format: "standard", autoSend: true, includeReceipts: true };
}
