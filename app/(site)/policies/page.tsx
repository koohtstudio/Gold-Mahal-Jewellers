import type { Metadata } from "next";
import { Confirm, Eyebrow, Heading, LinkButton } from "@/components/ui";
import s from "@/components/site/site.module.css";

export const metadata: Metadata = { title: "Shop rules", description: "How reserving, holds, the gold rate, trade-ins and layaway work at Gold Mahal. Sample rules to be confirmed by the owner." };

const RULES: Array<{ t: string; d: string; confirm?: string }> = [
  { t: "Reserve online, pay in store", d: "Choose your pieces, pick a day and time and you get a code like GM-4821. Nothing is charged online." },
  { t: "How long we hold a piece", d: "48 hours at the rate you saw, or until the end of your visit day if that is later.", confirm: "Hold time and visit day rule are defaults. Confirm with the owner." },
  { t: "The gold rate", d: "The owner sets the 24k rate each morning. 22k, 18k and 14k come from it. Every price on the site follows the rate." },
  { t: "How a price is worked out", d: "Net weight x the rate for its karat, plus the making charge, plus any stone. HST of 13% is added at the store." },
  { t: "Gold bars", d: "Priced at the day's rate plus a small premium. Shown without HST in this preview.", confirm: "Bullion HST treatment must be confirmed with the accountant." },
  { t: "Old gold", d: "Bring photo ID. You get an estimate online and the final value is confirmed in store.", confirm: "ID and record rules for buying old gold to be confirmed with the owner and accountant." },
  { t: "Layaway", d: "Ask in store about reserving a piece with a deposit and paying it off in instalments.", confirm: "Layaway terms to be confirmed." },
  { t: "Sample data", d: "Pieces, weights, prices and photos on this preview are samples. The store's real catalogue replaces them." },
];

export default function PoliciesPage() {
  return (
    <section className={`${s.sec} cream`}>
      <div className={s.wrap} style={{ maxWidth: 820 }}>
        <Eyebrow>Shop rules</Eyebrow>
        <Heading as="h1">
          How it <em>works here.</em>
        </Heading>
        <dl style={{ margin: "40px 0 0", display: "grid", gap: 26 }}>
          {RULES.map((r) => (
            <div key={r.t}>
              <dt style={{ font: "500 26px var(--font-display)" }}>{r.t}</dt>
              <dd style={{ margin: "4px 0 0", color: "var(--muted)" }}>
                {r.d}
                {r.confirm ? <Confirm why={r.confirm} /> : null}
              </dd>
            </div>
          ))}
        </dl>
        <div style={{ marginTop: 40 }}>
          <LinkButton href="/shop" variant="ink">
            Back to the shop
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
