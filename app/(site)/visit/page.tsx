import type { Metadata } from "next";
import { VisitSection } from "@/components/site/sections";

export const metadata: Metadata = { title: "Visit the store", description: "6121 Mayfield Rd #27, Brampton. Hours, phone and booking." };

export default function VisitPage() {
  return <VisitSection page />;
}
