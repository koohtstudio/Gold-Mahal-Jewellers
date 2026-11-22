import type { Metadata } from "next";
import { ShopSection } from "@/components/site/shop";

export const metadata: Metadata = { title: "Shop", description: "Gold jewellery priced by the gram at today's rate. Every price shown in full. Sample pieces." };

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const { cat } = await searchParams;
  return <ShopSection page initialCat={cat} />;
}
