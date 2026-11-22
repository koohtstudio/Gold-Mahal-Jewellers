"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button, Chip, Chips, CloseButton, Confirm, Dialog, Eyebrow, Heading, Label, LinkButton, Note, ProductImage, StateBlock } from "@/components/ui";
import { CATEGORIES } from "@/lib/domain/constants";
import type { Piece } from "@/lib/domain/schemas";
import { usePieces, usePiece } from "@/lib/hooks";
import { bag, useBag } from "@/lib/hooks/bag";
import { usePricing } from "@/lib/hooks/pricing";
import { availableUnits, grams, money, moneyWhole, pieceStatus } from "@/lib/pricing";
import { useSite } from "./chrome";
import s from "./site.module.css";

const CAT_LABEL: Record<string, string> = { Bars: "Gold bars" };
const catLabel = (c: string) => CAT_LABEL[c] ?? c;

function specOf(p: Piece) {
  return p.fixedCents !== undefined && p.karat === null ? "Silver" : `${p.karat}k · ${grams(p.netGramsMilli)}`;
}

export function PieceCard({ piece, index }: { piece: Piece; index: number }) {
  const { price } = usePricing();
  const { openPiece } = useSite();
  const status = pieceStatus(piece);
  const parts = price(piece);
  const badge = status === "sold" ? "Sold" : status === "reserved" ? "Reserved" : piece.badge;
  return (
    <Link
      href={`/shop/${piece.slug}`}
      className={s.card}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
        e.preventDefault();
        openPiece(piece.slug);
      }}
    >
      <div className={s.pic}>
        <ProductImage src={piece.image} alt={`${piece.name}`} sizes="(max-width: 899px) 50vw, 380px" priority={index < 4} />
        {badge ? <em className={`${s.badge} ${status === "reserved" ? s.badgeHold : status === "sold" ? s.badgeSold : ""}`} style={{ fontStyle: "normal" }}>{badge}</em> : null}
        <u className={s.spec} style={{ textDecoration: "none" }}>{specOf(piece)}</u>
      </div>
      <div className={s.cardBody}>
        <small>{catLabel(piece.category)}</small>
        <h3>{piece.name}</h3>
        <div className={s.pr}>
          <b>{moneyWhole(parts.totalCents)}</b>
          <span>{parts.fixed ? "Fixed price" : "Gold + making"}</span>
        </div>
      </div>
    </Link>
  );
}

export function ShopSection({ page, initialCat }: { page?: boolean; initialCat?: string }) {
  const { data, loading, error, refresh } = usePieces();
  const start = initialCat && (CATEGORIES as readonly string[]).includes(initialCat) ? initialCat : "All";
  const [cat, setCat] = useState(start);
  const pieces = useMemo(() => (data ?? []).filter((p) => cat === "All" || p.category === cat), [data, cat]);
  const pick = (c: string) => {
    setCat(c);
    try {
      const u = new URL(window.location.href);
      if (c === "All") u.searchParams.delete("cat");
      else u.searchParams.set("cat", c);
      window.history.replaceState(null, "", u);
    } catch {
      /* the filter still works */
    }
  };
  return (
    <section className={`${s.sec} cream`} id="shop" aria-labelledby="shop-title">
      <div className={s.wrap}>
        <div className={s.fh}>
          <div>
            <Eyebrow>Shop</Eyebrow>
            <Heading as={page ? "h1" : "h2"}>
              <span id="shop-title">
                Every price, <em>shown in full.</em>
              </span>
            </Heading>
          </div>
          <Chips label="Filter by category" scroll>
            {["All", ...CATEGORIES].map((c) => (
              <Chip key={c} on={cat === c} onClick={() => pick(c)}>
                {catLabel(c)}
              </Chip>
            ))}
          </Chips>
        </div>
        {error && !data ? (
          <div style={{ marginTop: 44 }}>
            <StateBlock kind="error" title="The collection did not load" text={error} action={<Button small variant="ink" onClick={refresh}>Try again</Button>} />
          </div>
        ) : loading && !data ? (
          <div style={{ marginTop: 44 }}>
            <StateBlock kind="loading" />
          </div>
        ) : pieces.length === 0 ? (
          <div style={{ marginTop: 44 }}>
            <StateBlock kind="empty" title="No pieces in this category right now" text="New pieces are added often. Ask us in store or book a visit." action={<Button small variant="ink" onClick={() => pick("All")}>Show everything</Button>} />
          </div>
        ) : (
          <div className={s.grid}>
            {pieces.map((p, i) => (
              <PieceCard key={p.id} piece={p} index={i} />
            ))}
          </div>
        )}
        <Note className="" >
          <span style={{ display: "block", marginTop: 22 }}>Sample pieces and weights. Prices update with the gold rate. Reserve online, pay in store.</span>
        </Note>
      </div>
    </section>
  );
}

/** Full breakdown plus the option picker and reserve button. Used in the dialog and on the product page. */
export function PieceDetail({ piece, onAdded, headingLevel = "h3" }: { piece: Piece; onAdded?: () => void; headingLevel?: "h1" | "h3" }) {
  const { price, settings } = usePricing();
  const { openBag, openVisit } = useSite();
  const inBag = useBag();
  const [opt, setOpt] = useState<string>(piece.options.length === 1 ? (piece.options[0] as string) : "");
  const parts = price(piece);
  const status = pieceStatus(piece);
  const inBagQty = inBag.filter((b) => b.pieceId === piece.id).reduce((a, b) => a + b.qty, 0);
  const left = availableUnits(piece) - inBagQty;
  const Tag = headingLevel;
  const needsOption = piece.options.length > 0 && !opt;
  const hold = settings?.holdHours ?? 48;
  return (
    <>
      <small style={{ letterSpacing: ".18em", textTransform: "uppercase", color: "var(--gold-dark)" }}>{catLabel(piece.category)}</small>
      <Tag style={{ font: "500 34px/1.1 var(--font-display)", margin: 0 }}>{piece.name}</Tag>
      <p style={{ margin: 0, color: "var(--muted)" }}>{piece.description}</p>
      <dl className={s.brk}>
        <div>
          <dt>{parts.fixed ? "Fixed price piece" : `${piece.karat}k gold, ${grams(piece.netGramsMilli)} at ${money(parts.ratePerGramCents)} per gram`}</dt>
          <dd />
        </div>
        {!parts.fixed ? (
          <>
            <div>
              <dt>Gold value</dt>
              <dd>{money(parts.goldCents)}</dd>
            </div>
            <div>
              <dt>{piece.category === "Bars" ? `Premium ${parts.makingBps / 100}%` : `Making charge ${parts.makingBps / 100}%`}</dt>
              <dd>{money(parts.makingCents)}</dd>
            </div>
          </>
        ) : null}
        {piece.stoneCents > 0 ? (
          <div>
            <dt>Stone</dt>
            <dd>{money(piece.stoneCents)}</dd>
          </div>
        ) : null}
        <div className={s.tt}>
          <dt>Price</dt>
          <dd>{money(parts.totalCents)}</dd>
        </div>
      </dl>
      {piece.taxFree ? (
        <Note>
          Shown without HST, as gold bars are priced here as exempt.
          <Confirm why="Bullion HST treatment must be confirmed with the accountant." />
        </Note>
      ) : null}
      {status === "in_case" && left > 0 ? (
        <>
          {piece.options.length > 1 ? (
            <div>
              <Label>{piece.optionLabel}</Label>
              <div className={s.sizes} role="group" aria-label={piece.optionLabel}>
                {piece.options.map((o) => (
                  <Chip key={o} on={opt === o} onClick={() => setOpt(o)}>
                    {o}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
          <Button
            variant="ink"
            disabled={needsOption}
            onClick={() => {
              bag.add(piece.id, opt || (piece.options[0] ?? ""));
              onAdded?.();
              openBag();
            }}
          >
            Reserve this piece
          </Button>
          {needsOption ? <Note>Choose a {piece.optionLabel.toLowerCase()} to reserve.</Note> : null}
          <Note>Held {hold} hours at today&apos;s rate. Pay in store. Sample weight and price.</Note>
        </>
      ) : status === "in_case" ? (
        <div className={s.status}>You already have every available unit of this piece in your bag.</div>
      ) : (
        <>
          <div className={s.status} role="status">
            <b>{status === "sold" ? "This piece has been sold." : "This piece is reserved for another customer."}</b>
            <br />
            {status === "sold" ? "Ask us about something similar or a custom piece." : "If it is not collected, it goes back in the case. Ask us to keep you posted."}
          </div>
          <Button variant="line" onClick={() => openVisit({ type: 0 })}>
            Ask about a similar piece
          </Button>
        </>
      )}
    </>
  );
}

export function PieceDialog() {
  const { piece: slug, closePiece } = useSite();
  const { data, loading } = usePiece(slug ?? "");
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    if (slug) setLast(slug);
  }, [slug]);
  const piece = slug ? data : null;
  return (
    <Dialog open={!!slug} onClose={closePiece} label={piece ? `${piece.name} details` : "Piece details"}>
      <div className={`${s.mdl} cream`}>
        <div className={s.mdlClose}>
          <CloseButton onClick={closePiece} />
        </div>
        {piece ? (
          <>
            <div className={s.pic2}>
              <ProductImage src={piece.image} alt={piece.name} sizes="(max-width: 899px) 100vw, 400px" priority />
            </div>
            <div className={s.bd2}>
              <PieceDetail piece={piece} onAdded={closePiece} />
              <Link href={`/shop/${piece.slug}`} onClick={closePiece} style={{ fontSize: 13, color: "var(--muted)", textDecoration: "underline", textUnderlineOffset: 3, minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                Open the full page for this piece
              </Link>
            </div>
          </>
        ) : (
          <div style={{ padding: 34, gridColumn: "1 / -1" }}>
            {loading ? <StateBlock kind="loading" /> : <StateBlock kind="empty" title="That piece is no longer listed" text="It may have been sold or taken down." action={<LinkButton href="/shop" variant="ink" small>See the shop</LinkButton>} />}
          </div>
        )}
      </div>
      <span hidden>{last}</span>
    </Dialog>
  );
}

export function ProductPage({ slug }: { slug: string }) {
  const { data, loading } = usePiece(slug);
  if (!data) {
    return (
      <section className={`${s.sec} cream`}>
        <div className={s.wrap}>
          {loading ? <StateBlock kind="loading" /> : <StateBlock kind="empty" title="We could not find that piece" text="It may have been sold or taken down. The collection is always changing." action={<LinkButton href="/shop" variant="ink" small>See the shop</LinkButton>} />}
        </div>
      </section>
    );
  }
  return (
    <section className={`${s.sec} cream`} style={{ paddingTop: 48 }}>
      <div className={s.wrap}>
        <p className={s.crumbs}>
          <Link href="/shop">Shop</Link> / {catLabel(data.category)} / {data.name}
        </p>
        <div className={s.detail}>
          <div className={s.detailPic}>
            <ProductImage src={data.image} alt={data.name} sizes="(max-width: 899px) 100vw, 480px" priority />
          </div>
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <PieceDetail piece={data} headingLevel="h1" />
          </div>
        </div>
      </div>
    </section>
  );
}
