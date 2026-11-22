import type { Metadata } from "next";
import { ProductPage } from "@/components/site/shop";
import { buildPieces } from "@/lib/mock/seed";
import { SAMPLE_RATE_24 } from "@/lib/mock/seed";
import { moneyWhole, priceOf } from "@/lib/pricing";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const piece = buildPieces(new Date()).find((p) => p.slug === slug && p.visible);
  if (!piece) return { title: "Piece" };
  const price = priceOf(piece, SAMPLE_RATE_24, { barPremiumBps: 200 }).totalCents;
  const title = piece.name;
  const description = `${piece.description} Sample price ${moneyWhole(price)} at a sample gold rate. Reserve online, pay in store.`;
  return { title, description, openGraph: { title, description, images: [{ url: piece.image, alt: piece.name }] }, twitter: { card: "summary_large_image", title, description, images: [piece.image] } };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  return <ProductPage slug={slug} />;
}
