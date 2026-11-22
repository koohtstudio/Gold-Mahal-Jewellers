"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, CloseButton, Dialog, Field, Heading, Icon, Label, LinkButton, Note, ProductImage, StateBlock } from "@/components/ui";
import { isDomainError, messageOf } from "@/lib/domain/errors";
import type { Reservation } from "@/lib/domain/schemas";
import { isValidPhone, lastFour, formatPhone } from "@/lib/guards";
import { repo, usePieces, useReservationLookup, useSlotLoad } from "@/lib/hooks";
import { bag, useBag } from "@/lib/hooks/bag";
import { usePricing } from "@/lib/hooks/pricing";
import { availableUnits, bagTotals, grams, money, moneyWhole, tradeInValue } from "@/lib/pricing";
import { dayKey, dayLabel, isoDate, nextOpenDays, timeLabel, windowDates, windowsFor } from "@/lib/time";
import { useSite } from "./chrome";
import s from "./site.module.css";

type Step = "bag" | "det" | "done";

const heldUntil = (iso: string) => `${dayLabel(isoDate(new Date(iso)))} at ${timeLabel(new Date(iso))}`;

export function BagDrawer() {
  const { bagOpen, closeBag } = useSite();
  return (
    <Dialog open={bagOpen} onClose={closeBag} label="Reserve bag" variant="drawer">
      <BagFlow onClose={closeBag} />
    </Dialog>
  );
}

function BagFlow({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("bag");
  const [done, setDone] = useState<Reservation | null>(null);
  const items = useBag();
  const { data: pieces } = usePieces();
  const { price, settings } = usePricing();
  const title = step === "bag" ? "Your reserve bag" : step === "det" ? "Choose a visit time" : "Reserved";

  const lines = items.map((b, index) => {
    const piece = pieces?.find((p) => p.id === b.pieceId);
    const avail = piece ? availableUnits(piece) : 0;
    return { b, index, piece, avail, unit: piece ? price(piece).totalCents : 0, problem: !piece || avail < 1 || b.qty > avail };
  });
  const good = lines.filter((l) => !l.problem && l.piece);
  const totals = bagTotals(good.map((l) => ({ unitCents: l.unit, qty: l.b.qty, taxFree: l.piece!.taxFree })));
  const hasProblem = lines.some((l) => l.problem);

  return (
    <div className={s.drawerBody}>
      <div className={s.dh}>
        <h2>{title}</h2>
        <CloseButton onClick={onClose} />
      </div>
      <ol className={s.steps} aria-label="Reserve steps">
        {(["bag", "det", "done"] as Step[]).map((k, i) => (
          <li key={k} aria-current={step === k ? "step" : undefined} className={(["bag", "det", "done"] as Step[]).indexOf(step) > i ? s.done : undefined}>
            {["Bag", "Visit time", "Done"][i]}
          </li>
        ))}
      </ol>

      {step === "bag" ? (
        lines.length === 0 ? (
          <StateBlock kind="empty" title="Nothing reserved yet" text="Pick a piece and it shows up here." action={<LinkButton href="/shop" variant="ink" small onClick={onClose}>Browse the shop</LinkButton>} />
        ) : (
          <>
            <div>
              {lines.map((l) => (
                <div className={s.ln} key={`${l.b.pieceId}-${l.b.option}`}>
                  <div className={s.lnImg}>{l.piece ? <ProductImage src={l.piece.image} alt="" sizes="76px" /> : null}</div>
                  <div>
                    <b>{l.piece?.name ?? "Piece no longer listed"}</b>
                    <small>
                      {l.piece ? `${l.piece.optionLabel} ${l.b.option}` : "Please remove it"}
                      {l.piece && l.avail < 1 ? " . Just reserved by someone else" : ""}
                    </small>
                    <div className={s.qty}>
                      <button type="button" onClick={() => bag.change(l.index, -1)} aria-label={`Less ${l.piece?.name ?? "item"}`}>
                        &minus;
                      </button>
                      <span aria-live="polite">{l.b.qty}</span>
                      <button type="button" onClick={() => bag.change(l.index, 1)} disabled={!l.piece || l.b.qty >= l.avail} aria-label={`More ${l.piece?.name ?? "item"}`}>
                        +
                      </button>
                      <Button small variant="line" style={{ marginLeft: 8, letterSpacing: ".06em" }} onClick={() => bag.remove(l.b.pieceId, l.b.option)} aria-label={`Remove ${l.piece?.name ?? "item"}`}>
                        Remove
                      </Button>
                    </div>
                  </div>
                  <span className={s.lnTotal}>{l.problem ? "" : moneyWhole(l.unit * l.b.qty)}</span>
                </div>
              ))}
            </div>
            {hasProblem ? (
              <p className="" role="alert" style={{ margin: 0, color: "#a63d1b", fontSize: 14 }}>
                One or more pieces are no longer available. Please remove them to continue.
              </p>
            ) : null}
            <div style={{ display: "grid", gap: 14, marginTop: "auto" }}>
              <dl className={s.rows}>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{money(totals.subtotalCents)}</dd>
                </div>
                <div>
                  <dt>HST 13%</dt>
                  <dd>{money(totals.hstCents)}</dd>
                </div>
                <div>
                  <dt>Total at the store</dt>
                  <dd>{money(totals.totalCents)}</dd>
                </div>
              </dl>
              <Note>Pay in store. Price held for {settings?.holdHours ?? 48} hours at the rate shown. Gold bars are shown without HST (sample, to be confirmed).</Note>
              <Button variant="ink" disabled={hasProblem || good.length === 0} onClick={() => setStep("det")}>
                Choose a visit time
              </Button>
            </div>
          </>
        )
      ) : null}

      {step === "det" ? (
        <VisitTimeStep
          lines={good.map((l) => ({ pieceId: l.b.pieceId, option: l.b.option, qty: l.b.qty }))}
          totalCents={totals.totalCents}
          onBack={() => setStep("bag")}
          onSoldOut={() => setStep("bag")}
          onDone={(r) => {
            bag.clear();
            setDone(r);
            setStep("done");
          }}
        />
      ) : null}

      {step === "done" && done ? <DoneStep reservation={done} onClose={onClose} /> : null}
    </div>
  );
}

function VisitTimeStep({ lines, totalCents, onBack, onSoldOut, onDone }: { lines: Array<{ pieceId: string; option: string; qty: number }>; totalCents: number; onBack: () => void; onSoldOut: () => void; onDone: (r: Reservation) => void }) {
  const { settings } = usePricing();
  const days = useMemo(() => (settings ? nextOpenDays(new Date(), settings, 8) : []), [settings]);
  const [di, setDi] = useState(0);
  const [wi, setWi] = useState(-1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hp, setHp] = useState("");
  const [touched, setTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t0 = useRef(Date.now());
  const day = days[di];
  const wins = useMemo(() => (day ? windowsFor(day.openMin, day.closeMin) : []), [day]);
  const load = useSlotLoad(day?.date ?? "").data ?? {};
  const cap = settings?.slotCapacity ?? 3;
  const now = Date.now();
  const winState = wins.map((w) => {
    const d = day ? windowDates(day.date, w) : null;
    const past = d ? d.end.getTime() <= now : false;
    const full = d ? (load[d.start.toISOString()] ?? 0) >= cap : false;
    return { w, d, off: past || full, full };
  });
  const chosen = wi > -1 ? winState[wi] : undefined;
  const nameOk = name.trim().length >= 2;
  const phoneOk = isValidPhone(phone);
  const ready = !!chosen && !chosen.off && nameOk && phoneOk && !busy;
  const summary = day && chosen ? `${day.label}, ${chosen.w.label}` : "Choose a day and time";

  async function submit() {
    setTouched(true);
    if (!ready || !chosen?.d) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await repo().reservations.create({ lines, name, phone, visitStartAt: chosen.d.start.toISOString(), visitEndAt: chosen.d.end.toISOString(), _hp: hp, _t: Date.now() - t0.current });
      onDone(r);
    } catch (e) {
      setErr(messageOf(e));
      if (isDomainError(e) && (e.code === "sold_out" || e.code === "not_found")) onSoldOut();
    } finally {
      setBusy(false);
    }
  }

  if (!settings || days.length === 0) return <StateBlock kind="loading" />;
  if (settings.acceptOrders === false) return <StateBlock kind="empty" title="Online reserving is paused" text="Please call the store and we will look after you." action={<Button variant="ink" small onClick={onBack}>Back to bag</Button>} />;

  return (
    <form
      className={s.stack}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <Label>Day</Label>
        <div className={s.days} role="group" aria-label="Visit day">
          {days.map((d, i) => (
            <button key={d.date} type="button" className={`${s.day} ${di === i ? s.dayOn : ""}`} aria-pressed={di === i} aria-label={d.label} onClick={() => (setDi(i), setWi(-1))}>
              {d.dow}
              <b>{d.num}</b>
              {d.mon}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Time</Label>
        <div className={s.tms} role="group" aria-label="Visit time">
          {winState.map((w, i) => (
            <button key={w.w.label} type="button" className={`${s.tm} ${wi === i ? s.tmOn : ""}`} disabled={w.off} aria-pressed={wi === i} onClick={() => setWi(i)}>
              {w.w.label}
              {w.full ? " (full)" : ""}
            </button>
          ))}
        </div>
      </div>
      <Field label="Name" error={touched && !nameOk ? "Please enter your name." : null}>
        {(p) => <input {...p} type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
      </Field>
      <Field label="Mobile" hint="10 digits. We text you to confirm." error={touched && !phoneOk ? "Please enter a 10 digit mobile number." : null}>
        {(p) => <input {...p} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="416 555 0100" />}
      </Field>
      <div className={s.hp} aria-hidden="true">
        <label>
          Leave this empty
          <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
      </div>
      <dl className={s.rows}>
        <div>
          <dt>Visit</dt>
          <dd style={{ textAlign: "right" }}>{summary}</dd>
        </div>
        <div>
          <dt>Total at the store</dt>
          <dd>{money(totalCents)}</dd>
        </div>
      </dl>
      {touched && !chosen ? (
        <p role="alert" style={{ margin: 0, color: "#a63d1b", fontSize: 14 }}>
          Please choose a time.
        </p>
      ) : null}
      {err ? (
        <p role="alert" style={{ margin: 0, color: "#a63d1b", fontSize: 14 }}>
          {err}
        </p>
      ) : null}
      <Button variant="ink" type="submit" disabled={busy} aria-busy={busy}>
        {busy ? "Reserving" : "Reserve my pieces"}
      </Button>
      <Button variant="line" onClick={onBack}>
        Back to bag
      </Button>
    </form>
  );
}

function DoneStep({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const last4 = lastFour(reservation.phone);
  const live = useReservationLookup(reservation.code, last4).data ?? reservation;
  const first = reservation.customer.split(" ")[0];
  return (
    <div className={s.stack}>
      <div className={s.codebox}>
        <small>Your reserve code</small>
        <b>{reservation.code}</b>
      </div>
      {live.status === "ready" ? (
        <div className={s.status} role="status">
          <b>Ready for pickup.</b> The store has your pieces set aside.
        </div>
      ) : live.status === "sold" ? (
        <div className={s.status} role="status">
          <b>Picked up.</b> Thank you for visiting Gold Mahal.
        </div>
      ) : null}
      <p style={{ margin: 0 }}>
        Thanks {first}. Your pieces are held until {heldUntil(reservation.holdUntil)}. Show this code at the counter on {reservation.visitLabel}. We will text {formatPhone(reservation.phone)} to confirm.
      </p>
      <Note>Design preview. Nothing was charged and no real text was sent. The store sees your reservation in its admin.</Note>
      <LinkButton href={`/reservation/${reservation.code}?k=${last4}`} variant="line" onClick={onClose}>
        See your reservation
      </LinkButton>
      <Button variant="ink" onClick={onClose}>
        Back to the shop
      </Button>
    </div>
  );
}

export const VISIT_REASONS = ["Custom design", "Repairs and resizing", "Gold bars", "Layaway plan", "Cleaning and care", "Old gold valuation"];

export function VisitDialog() {
  const { visit, closeVisit } = useSite();
  return (
    <Dialog open={visit.open} onClose={closeVisit} label="Book a visit">
      <div className={`${s.mdl} ${s.mdlQ} cream`}>
        <CloseButton onClick={closeVisit} />
        <VisitForm key={JSON.stringify(visit.opts)} opts={visit.opts} onClose={closeVisit} />
      </div>
    </Dialog>
  );
}

function VisitForm({ opts, onClose }: { opts: { type?: number; valuation?: { karat: 24 | 22 | 18 | 14; gramsMilli: number } }; onClose: () => void }) {
  const { settings, rate24 } = usePricing();
  const [type, setType] = useState(opts.type ?? 0);
  const firstOpen = useMemo(() => (settings ? (nextOpenDays(new Date(), settings, 1)[0]?.date ?? isoDate(new Date())) : ""), [settings]);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hp, setHp] = useState("");
  const [touched, setTouched] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const t0 = useRef(Date.now());
  useEffect(() => {
    setDate((d) => d || firstOpen);
  }, [firstOpen]);
  const val = opts.valuation && type === 5 ? opts.valuation : null;
  const est = val ? tradeInValue(val.gramsMilli, val.karat, rate24, Math.round((settings?.buyRatePct ?? 94) * 100)) : null;
  const closedDay = !!date && !!settings && !settings.hours[dayKey(date)];
  const dateErr = !date ? "Please choose a day." : closedDay ? "We are closed that day. Please choose another." : null;
  const nameOk = name.trim().length >= 2;
  const phoneOk = isValidPhone(phone);

  async function submit() {
    setTouched(true);
    if (dateErr || !nameOk || !phoneOk) return;
    setBusy(true);
    setErr(null);
    try {
      if (val) await repo().visits.addValuation({ karat: val.karat, gramsMilli: val.gramsMilli, name, phone, preferredDate: date, _hp: hp, _t: Date.now() - t0.current });
      else await repo().visits.addVisit({ type: VISIT_REASONS[type] as string, preferredDate: date, name, phone, _hp: hp, _t: Date.now() - t0.current });
      setSent(`${name.trim().split(" ")[0]}|${formatPhone(phone)}`);
    } catch (e) {
      setErr(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    const [first, shown] = sent.split("|");
    return (
      <div className={s.stack}>
        <h2>Request sent.</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Thanks {first}. We will call {shown} to confirm your {(VISIT_REASONS[type] as string).toLowerCase()} visit on {dayLabel(date, true)}.
        </p>
        <Note>Design preview. Nothing was emailed or texted. The request is saved in the store&apos;s admin.</Note>
        <Button variant="ink" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  return (
    <form
      className={s.stack}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h2>{type === 5 ? "Book a valuation" : "Book a visit"}</h2>
      <p style={{ margin: 0, color: "var(--muted)" }}>Tell us what you need and when. We will call to confirm.</p>
      <div>
        <Label>What for</Label>
        <div className={s.sizes} role="group" aria-label="Reason for visit">
          {VISIT_REASONS.map((r, i) => (
            <Chip key={r} on={type === i} onClick={() => setType(i)}>
              {r}
            </Chip>
          ))}
        </div>
      </div>
      {est && val ? (
        <div className={s.status}>
          Your estimate: <b>{money(est.valueCents)}</b> for {grams(val.gramsMilli)} of {val.karat}k. Final value is confirmed in store.
        </div>
      ) : null}
      <Field label="Day" error={touched ? dateErr : null}>
        {(p) => <input {...p} type="date" value={date} min={isoDate(new Date())} onChange={(e) => setDate(e.target.value)} />}
      </Field>
      <Field label="Name" error={touched && !nameOk ? "Please enter your name." : null}>
        {(p) => <input {...p} type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
      </Field>
      <Field label="Mobile" error={touched && !phoneOk ? "Please enter a 10 digit mobile number." : null}>
        {(p) => <input {...p} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="416 555 0100" />}
      </Field>
      <div className={s.hp} aria-hidden="true">
        <label>
          Leave this empty
          <input type="text" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
      </div>
      {err ? (
        <p role="alert" style={{ margin: 0, color: "#a63d1b", fontSize: 14 }}>
          {err}
        </p>
      ) : null}
      <Button variant="ink" type="submit" disabled={busy} aria-busy={busy}>
        {busy ? "Sending" : "Send request"}
      </Button>
    </form>
  );
}

/* The customer's own page. It updates by itself when the store taps Ready or Sold. */
export function ReservationStatus({ code, initialLast4 }: { code: string; initialLast4: string }) {
  const router = useRouter();
  const [k, setK] = useState(initialLast4);
  const [entry, setEntry] = useState("");
  const { data, loading, error } = useReservationLookup(code, k);
  const asked = k.length === 4;

  if (!asked) {
    return (
      <form
        className={s.stack}
        onSubmit={(e) => {
          e.preventDefault();
          const d = entry.replace(/\D/g, "");
          if (d.length === 4) {
            setK(d);
            router.replace(`/reservation/${code}?k=${d}`);
          }
        }}
      >
        <Heading as="h1">Find your reservation</Heading>
        <p style={{ margin: 0, color: "var(--muted)" }}>Enter the last four digits of the mobile number you used for {code.toUpperCase()}.</p>
        <Field label="Last four digits">{(p) => <input {...p} inputMode="numeric" maxLength={4} value={entry} onChange={(e) => setEntry(e.target.value)} autoComplete="off" />}</Field>
        <Button variant="ink" type="submit" disabled={entry.replace(/\D/g, "").length !== 4}>
          Show my reservation
        </Button>
      </form>
    );
  }
  if (loading && !data) return <StateBlock kind="loading" />;
  if (error) return <StateBlock kind="error" title="We could not load that" text={error} />;
  if (!data)
    return (
      <StateBlock
        kind="empty"
        title="We could not find that reservation"
        text="Check the code and the last four digits of your phone. If it still does not show, call the store."
        action={
          <Button variant="ink" small onClick={() => setK("")}>
            Try again
          </Button>
        }
      />
    );
  const stageIdx = data.status === "new" ? 0 : data.status === "ready" ? 1 : data.status === "sold" ? 2 : -1;
  return (
    <div className={s.stack}>
      <Heading as="h1">{data.code}</Heading>
      <ol className={s.steps} aria-label="Reservation progress">
        {["Reserved", "Ready for pickup", "Picked up"].map((l, i) => (
          <li key={l} aria-current={stageIdx === i ? "step" : undefined} className={stageIdx > i ? s.done : undefined}>
            {l}
          </li>
        ))}
      </ol>
      {data.status === "released" || data.status === "expired" ? (
        <div className={s.status} role="status">
          <b>{data.status === "expired" ? "This hold has ended." : "This hold was released."}</b> The pieces are back in the case. Call the store if you would still like them.
        </div>
      ) : (
        <div className={s.status} role="status" aria-live="polite">
          {data.status === "new" ? `Held for you until ${heldUntil(data.holdUntil)}.` : data.status === "ready" ? "Ready for pickup. Show your code at the counter." : "Picked up. Thank you for visiting Gold Mahal."}
        </div>
      )}
      <div>
        {data.lines.map((l) => (
          <div className={s.ln} key={`${l.pieceId}-${l.option}`} style={{ gridTemplateColumns: "76px 1fr auto" }}>
            <div className={s.lnImg}>
              <ProductImage src={l.image} alt="" sizes="76px" />
            </div>
            <div>
              <b>{l.name}</b>
              <small>
                {l.option} x {l.qty}
              </small>
            </div>
            <span className={s.lnTotal}>{moneyWhole(l.unitCents * l.qty)}</span>
          </div>
        ))}
      </div>
      <dl className={s.rows}>
        <div>
          <dt>Visit</dt>
          <dd style={{ textAlign: "right" }}>{data.visitLabel}</dd>
        </div>
        <div>
          <dt>Locked 24k rate</dt>
          <dd>{money(data.lockedRate24Cents)} per gram</dd>
        </div>
        <div>
          <dt>Subtotal</dt>
          <dd>{money(data.subtotalCents)}</dd>
        </div>
        <div>
          <dt>HST</dt>
          <dd>{money(data.hstCents)}</dd>
        </div>
        <div>
          <dt>Total at the store</dt>
          <dd>{money(data.totalCents)}</dd>
        </div>
      </dl>
      <Note>Design preview. Nothing was charged. Pay in store.</Note>
      <LinkButton href="/shop" variant="ink">
        Back to the shop
      </LinkButton>
      <Link href="/visit" style={{ textDecoration: "underline", textUnderlineOffset: 3, minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <Icon name="pin" size={16} /> Store hours and address
      </Link>
    </div>
  );
}
