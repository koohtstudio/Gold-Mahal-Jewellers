"use client";

import { useState } from "react";
import { Pill } from "@/components/ui";
import type { Job } from "@/lib/domain/schemas";
import { isValidPhone } from "@/lib/guards";
import { repo, useJobs } from "@/lib/hooks";
import { money, moneyWhole, parseCents } from "@/lib/pricing";
import { addDays, isoDate, shortDate } from "@/lib/time";
import { AField, Btn, Card, Empty, QueryView, useRun } from "../kit";
import s from "../admin.module.css";

const STAGES: Array<{ key: Job["stage"]; title: string }> = [
  { key: "intake", title: "Intake" },
  { key: "workshop", title: "In workshop" },
  { key: "ready", title: "Ready for pickup" },
];
const TYPE_LABEL = { custom: "Custom design", repair: "Repair", resize: "Resize" } as const;

export function JobsPage() {
  const q = useJobs();
  const { run, busy } = useRun();
  return (
    <>
      <p style={{ margin: 0, color: "var(--muted)" }}>Custom designs and repairs. Every job gets a ticket, a quote, a deposit and a promise date.</p>
      <QueryView q={q} isEmpty={() => false}>
        {(jobs) => {
          const open = jobs.filter((j) => !j.closedAt);
          const closed = jobs.length - open.length;
          return (
            <>
              <div className={s.kan}>
                {STAGES.map((st) => {
                  const cards = open.filter((j) => j.stage === st.key);
                  return (
                    <section className={s.col} key={st.key} aria-label={st.title}>
                      <h2>
                        <span>{st.title}</span>
                        <span>{cards.length}</span>
                      </h2>
                      {cards.length === 0 ? <p className={s.note} style={{ margin: "8px 4px" }}>Nothing here.</p> : null}
                      {cards.map((j) => (
                        <div className={s.jc} key={j.id}>
                          <b>
                            {j.ticket} · {j.customer}
                          </b>
                          <small>
                            {j.title} · {TYPE_LABEL[j.type]} · promised {shortDate(j.dueDate)}
                          </small>
                          <div className={s.jv}>{moneyWhole(j.quoteCents)}</div>
                          <div className={s.mv}>
                            <Pill tone={st.key === "intake" ? "new" : st.key === "workshop" ? "gold" : "ready"}>{j.depositCents > 0 ? `Deposit ${money(j.depositCents)}` : "No deposit"}</Pill>
                            {st.key === "intake" ? (
                              <Btn small variant="line" disabled={busy} onClick={() => run(() => repo().jobs.advance(j.id), `${j.ticket} sent to the workshop.`)}>
                                Start work
                              </Btn>
                            ) : st.key === "workshop" ? (
                              <Btn small variant="line" disabled={busy} onClick={() => run(() => repo().jobs.advance(j.id), `${j.ticket} is ready. Text logged for ${j.customer} (preview, nothing was sent).`)}>
                                Mark ready, text
                              </Btn>
                            ) : (
                              <Btn small variant="line" disabled={busy} onClick={() => run(() => repo().jobs.collectBalance(j.id), `${j.ticket} handed over. Balance ${money(j.quoteCents - j.depositCents)} added to the books.`)}>
                                Hand over, take balance
                              </Btn>
                            )}
                          </div>
                        </div>
                      ))}
                    </section>
                  );
                })}
              </div>
              {closed > 0 ? <p className={s.note} style={{ margin: 0 }}>{closed} job{closed === 1 ? "" : "s"} handed over and closed.</p> : null}
              {open.length === 0 ? <Card><Empty title="No open jobs" text="Add a custom design or repair below." /></Card> : null}
            </>
          );
        }}
      </QueryView>
      <NewJob />
    </>
  );
}

function NewJob() {
  const { run, busy } = useRun();
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<Job["type"]>("repair");
  const [title, setTitle] = useState("");
  const [quote, setQuote] = useState("");
  const [deposit, setDeposit] = useState("");
  const [due, setDue] = useState(addDays(isoDate(new Date()), 7));
  const [touched, setTouched] = useState(false);
  const quoteC = parseCents(quote);
  const depC = deposit.trim() === "" ? 0 : parseCents(deposit);
  const errs = {
    customer: customer.trim().length < 2 ? "Enter the customer's name." : null,
    title: title.trim().length < 2 ? "Describe the job." : null,
    quote: quoteC === null ? "Enter the quote." : null,
    deposit: depC === null ? "Enter a number." : quoteC !== null && depC > quoteC ? "The deposit is more than the quote." : null,
    phone: phone.trim() && !isValidPhone(phone) ? "Enter a 10 digit mobile number." : null,
  };
  async function add() {
    setTouched(true);
    if (Object.values(errs).some(Boolean)) return;
    const j = await run(() => repo().jobs.add({ customer, ...(phone.trim() ? { phone } : {}), type, title, quoteCents: quoteC as number, depositCents: depC as number, dueDate: due }), (x) => `Ticket ${x.ticket} created.`);
    if (j) {
      setCustomer("");
      setPhone("");
      setTitle("");
      setQuote("");
      setDeposit("");
      setTouched(false);
    }
  }
  return (
    <Card title="New job">
      <form
        className={s.stack}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div className={s.ex}>
          <AField label="Customer" error={touched ? errs.customer : null}>{(p) => <input {...p} value={customer} onChange={(e) => setCustomer(e.target.value)} />}</AField>
          <AField label="Mobile (to text when ready)" error={touched ? errs.phone : null}>{(p) => <input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}</AField>
          <AField label="Type">
            {(p) => (
              <select {...p} value={type} onChange={(e) => setType(e.target.value as Job["type"])}>
                <option value="repair">Repair</option>
                <option value="resize">Resize</option>
                <option value="custom">Custom design</option>
              </select>
            )}
          </AField>
        </div>
        <div className={s.ex}>
          <AField label="What is it" error={touched ? errs.title : null}>{(p) => <input {...p} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ring resize to 7" />}</AField>
          <AField label="Quote, HST included ($)" error={touched ? errs.quote : null}>{(p) => <input {...p} inputMode="decimal" value={quote} onChange={(e) => setQuote(e.target.value)} />}</AField>
          <AField label="Deposit taken ($)" error={touched ? errs.deposit : null}>{(p) => <input {...p} inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" />}</AField>
        </div>
        <div className={s.ex}>
          <AField label="Promise date">{(p) => <input {...p} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}</AField>
        </div>
        <div>
          <Btn type="submit" disabled={busy}>
            Create ticket
          </Btn>
        </div>
      </form>
    </Card>
  );
}
