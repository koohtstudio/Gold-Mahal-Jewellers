import type { Metadata } from "next";
import { TradeInSection } from "@/components/site/sections";

export const metadata: Metadata = { title: "Old gold trade-in estimate", description: "Estimate what your old gold is worth toward something new, then book a valuation. Estimate only." };

export default function TradeInPage() {
  return <TradeInSection page />;
}
