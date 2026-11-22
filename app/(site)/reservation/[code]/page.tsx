import type { Metadata } from "next";
import { ReservationStatus } from "@/components/site/reserve";
import s from "@/components/site/site.module.css";

export const metadata: Metadata = { title: "Your reservation", robots: { index: false, follow: false } };

export default async function ReservationPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ k?: string }> }) {
  const { code } = await params;
  const { k } = await searchParams;
  return (
    <section className={`${s.sec} cream`}>
      <div className={s.wrap} style={{ maxWidth: 640 }}>
        <ReservationStatus code={code} initialLast4={(k ?? "").replace(/\D/g, "").slice(0, 4)} />
      </div>
    </section>
  );
}
