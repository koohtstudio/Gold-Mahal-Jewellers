/**
 * Claims the owner has to confirm before the live site may say them. Each starts false.
 * When a claim is false, the site shows neutral wording instead. Flip one flag after the owner says yes in writing.
 * Every item is listed in docs/CONTENT_TODO.md.
 */
export const CLAIMS = {
  /** "Certified stones", "GRA certified moissanite", certificate shown in store. */
  certifiedStones: false,
  /** Any statement that gold is hallmarked or of tested purity. */
  hallmark: false,
  /** "We test everything in front of you". A purity testing claim. */
  testedInStore: false,
  /** Any promise to buy back what the store sold. */
  buyback: false,
  /** Ultrasonic cleaning is offered. */
  ultrasonicClean: false,
  /** Gold bars are HST exempt. Shown as a sample with confirm until the accountant says so. */
  barsHstExempt: false,
  /** Customers may pay at the store with a card. Not mentioned until confirmed. */
  cardAtStore: false,
} as const;

export const SHOP = {
  name: "Gold Mahal Jewellers",
  tagline: "Trust Purity Value",
  address1: "6121 Mayfield Rd #27",
  address2: "Brampton, ON L6P 4R9",
  phone: "(905) 913-1212",
  phoneHref: "tel:+19059131212",
  area: "Mayfield and Airport Road plaza, Brampton",
  instagram: "@goldmahal_jewellers",
} as const;
