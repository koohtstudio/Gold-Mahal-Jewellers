import type { Metadata } from "next";
import { RateSection } from "@/components/site/sections";

export const metadata: Metadata = { title: "Today's gold rate and price calculator", description: "See today's 24k, 22k and 18k gold rate per gram and work out what a piece costs. Sample rates." };

export default function RatePage() {
  return <RateSection page />;
}
