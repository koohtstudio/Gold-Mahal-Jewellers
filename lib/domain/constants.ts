/** Plain constants, kept apart from the Zod schemas so screens can use them without loading Zod. */
export const KARATS = [24, 22, 18, 14] as const;
export const CATEGORIES = ["Earrings", "Chains", "Bridal", "Diamonds", "Bars"] as const;
export const EXPENSE_CATEGORIES = ["Gold purchase", "Diamonds and stones", "Rent", "Insurance", "Packaging", "Advertising", "Other"] as const;
export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const STORE_VERSION = 1 as const;
