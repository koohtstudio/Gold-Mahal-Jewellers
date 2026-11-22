"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SHOP } from "@/lib/content/claims";
import { useBag } from "@/lib/hooks/bag";
import { useMounted } from "@/lib/hooks";
import { usePricing } from "@/lib/hooks/pricing";
import { money } from "@/lib/pricing";
import { whenLabel } from "@/lib/time";
import { Confirm, Icon } from "@/components/ui";
import s from "./site.module.css";

export interface VisitRequestOpts {
  /** Index into the visit reasons list. */
  type?: number;
  valuation?: { karat: 24 | 22 | 18 | 14; gramsMilli: number };
}

interface SiteCtx {
  bagOpen: boolean;
  openBag: () => void;
  closeBag: () => void;
  piece: string | null;
  openPiece: (slug: string) => void;
  closePiece: () => void;
  visit: { open: boolean; opts: VisitRequestOpts };
  openVisit: (opts?: VisitRequestOpts) => void;
  closeVisit: () => void;
}

const Ctx = createContext<SiteCtx | null>(null);
export function useSite(): SiteCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSite needs SiteProvider");
  return c;
}

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [bagOpen, setBagOpen] = useState(false);
  const [piece, setPiece] = useState<string | null>(null);
  const [visit, setVisit] = useState<{ open: boolean; opts: VisitRequestOpts }>({ open: false, opts: {} });
  const value = useMemo<SiteCtx>(
    () => ({
      bagOpen,
      openBag: () => {
        setPiece(null);
        setBagOpen(true);
      },
      closeBag: () => setBagOpen(false),
      piece,
      openPiece: (slug) => setPiece(slug),
      closePiece: () => setPiece(null),
      visit,
      openVisit: (opts = {}) => setVisit({ open: true, opts }),
      closeVisit: () => setVisit((v) => ({ ...v, open: false })),
    }),
    [bagOpen, piece, visit],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function TopBar() {
  const { openBag } = useSite();
  const items = useBag();
  const count = items.reduce((a, b) => a + b.qty, 0);
  const mounted = useMounted();
  const { rate, rates, settings } = usePricing();
  const show = settings?.showRateOnSite !== false;
  const stamp = settings?.showUpdatedAt !== false && rate && mounted ? `Updated ${whenLabel(rate.publishedAt)} (sample)` : "Rate set each morning (sample)";
  const set = (
    <>
      {show ? (
        <>
          <span>
            24k<b>{money(rates[24])}/g</b>
          </span>
          <span>
            22k<b>{money(rates[22])}/g</b>
          </span>
          <span>
            18k<b>{money(rates[18])}/g</b>
          </span>
        </>
      ) : (
        <span>Ask in store for today&apos;s rate</span>
      )}
      <span suppressHydrationWarning>{stamp}</span>
    </>
  );
  return (
    <header className={s.tick}>
      <Link className={s.mk} href="/" aria-label="Gold Mahal Jewellers, home">
        GOLD MAHAL
      </Link>
      <div className={s.rt} role="group" aria-label="Today's gold rate per gram">
        <div className={s.track}>
          {set}
          <span className={s.dupe} aria-hidden="true">
            {set}
          </span>
        </div>
      </div>
      <nav className={s.nv} aria-label="Main">
        <Link href="/rate">Gold rate</Link>
        <Link href="/shop">Shop</Link>
        <Link href="/trade-in">Old gold</Link>
        <Link href="/visit">Visit</Link>
      </nav>
      <button type="button" className={s.bagb} onClick={openBag}>
        <Icon name="bag" />
        <span className={s.tx}>Reserve</span>
        <i aria-hidden="true">{count}</i>
        <span className="sr-only">
          {count} {count === 1 ? "item" : "items"} in the bag
        </span>
      </button>
    </header>
  );
}

export function FloatingBar() {
  const { openVisit } = useSite();
  return (
    <nav className={s.cta} aria-label="Quick actions">
      <Link href="/rate">Price a piece</Link>
      <Link href="/shop">Shop</Link>
      <button type="button" onClick={() => openVisit()}>
        Book a visit
      </button>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className={s.foot}>
      <div className={`${s.wrap} ${s.fg}`}>
        <div>
          <div className={`${s.footMark} ${s.gradText}`}>GOLD MAHAL</div>
          <p>Trust Purity Value. 22k gold, diamonds and moissanite in Brampton.</p>
          <p>Design preview. Sample prices and weights.</p>
        </div>
        <nav aria-label="Explore">
          <h4>Explore</h4>
          <Link href="/rate">Gold rate</Link>
          <Link href="/shop">Shop</Link>
          <Link href="/trade-in">Old gold</Link>
          <Link href="/#services">Services</Link>
          <Link href="/policies">Shop rules</Link>
        </nav>
        <nav aria-label="Visit">
          <h4>Visit</h4>
          <Link href="/visit">
            {SHOP.address1}
            <Confirm why="Instagram caption lists a second address, Unit 56. Confirm with the owner." />
          </Link>
          <a href={SHOP.phoneHref}>
            {SHOP.phone}
            <Confirm why="Instagram caption lists 647-291-2461. Confirm which number is right." />
          </a>
          <Link href="/visit">Closed Mondays</Link>
        </nav>
      </div>
    </footer>
  );
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  const close = useCallback(() => {}, []);
  void close;
  return <div className={s.page}>{children}</div>;
}
