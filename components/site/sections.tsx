"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button, Chip, Chips, Confirm, Eyebrow, Heading, Icon, Label, LinkButton, Lead, Note, ProductImage, Stepper, type IconName } from "@/components/ui";
import { CLAIMS, SHOP } from "@/lib/content/claims";
import { hoursRows, openSummary } from "@/lib/content/hours";
import type { Karat } from "@/lib/domain/schemas";
import { defaultSettings } from "@/lib/mock/defaults";
import { usePricing } from "@/lib/hooks/pricing";
import { calcEstimate, grams, money, tradeInValue } from "@/lib/pricing";
import { useSite } from "./chrome";
import s from "./site.module.css";

const KARAT_CHIPS: Karat[] = [24, 22, 18, 14];
const MAKING = [0, 500, 800, 1200, 1500];

export function Hero() {
  const { rates, settings } = usePricing();
  const sum = openSummary((settings ?? defaultSettings()).hours);
  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={`${s.wrap} ${s.hg}`}>
        <div>
          <Eyebrow>{SHOP.address1.replace(" #27", "")}, Brampton</Eyebrow>
          <h1 id="hero-title">
            <span className={s.gradText}>Trust.</span>
            <br />
            <span className={s.gradText}>Purity.</span>
            <br />
            <em className={s.gradText}>Value.</em>
          </h1>
          <p className={s.sub}>22k gold jewellery, diamonds and moissanite, priced by the gram at today&apos;s rate. See the maths on every piece before you walk in.</p>
          <div className={s.ctas}>
            <LinkButton href="/rate">Price a piece</LinkButton>
            <LinkButton href="/shop" variant="line">
              Browse the collection
            </LinkButton>
          </div>
          <div className={s.hstats}>
            <div>
              <b>22k</b>
              <span>Gold</span>
            </div>
            <div>
              <b>
                5.0<Confirm why="Google rating from Google Maps. Confirm it is current." />
              </b>
              <span>Google rating</span>
            </div>
            <div>
              <b>Diamonds</b>
              <span>and moissanite</span>
            </div>
          </div>
        </div>
        <div className={s.arch}>
          <div className={s.archIn}>
            <ProductImage src="/images/hero-jhumka.jpg" alt="Pair of gold jhumka earrings on black cloth" sizes="(max-width: 899px) 90vw, 470px" priority />
          </div>
          <div className={s.inset}>
            <div className={s.insetIn}>
              <ProductImage src="/images/necklace-set-green.jpg" alt="Gold necklace set on a bust" sizes="150px" />
            </div>
          </div>
          <div className={s.chipBox} style={{ left: -30, top: 60 }}>
            <b>{money(rates[22])}</b>22k per gram today
          </div>
          <div className={s.chipBox} style={{ right: -24, top: 120 }}>
            <b>{sum.open}</b>
            {sum.closed}
            <Confirm why="Hours from Google Maps. Confirm holiday hours." />
          </div>
        </div>
      </div>
    </section>
  );
}

export function TrustStrip() {
  const items = [
    { t: "Trust Purity Value", d: "Our promise, in our own words." },
    { t: "Priced by weight", d: "Gold value and making charge shown separately." },
    { t: "Old gold welcome", d: "Get a trade-in estimate before you visit." },
    CLAIMS.certifiedStones ? { t: "Certified stones", d: "GRA certified moissanite and diamonds." } : { t: "Diamonds and moissanite", d: "Ask in store about stone details and certificates." },
  ];
  return (
    <section className={s.trust} aria-label="Why Gold Mahal">
      <div className={`${s.wrap} ${s.trustGrid}`}>
        {items.map((i) => (
          <div key={i.t} className={s.trustItem}>
            <Icon name="check" size={24} strokeWidth={1.6} />
            <div>
              <b>{i.t}</b>
              <span>{i.d}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RateSection({ page }: { page?: boolean }) {
  const { rate, rates, rate24, settings } = usePricing();
  const [ki, setKi] = useState(1);
  const [gm, setGm] = useState(5000);
  const [mi, setMi] = useState(2);
  const est = calcEstimate(rate24, KARAT_CHIPS[ki] as Karat, gm, MAKING[mi] as number);
  const show = settings?.showRateOnSite !== false;
  return (
    <section className={`${s.sec} cream`} id="rate" aria-labelledby="rate-title">
      <div className={s.wrap}>
        <Eyebrow>Today&apos;s gold rate</Eyebrow>
        <Heading as={page ? "h1" : "h2"}>
          <span id="rate-title">
            Know the price <em>before you ask.</em>
          </span>
        </Heading>
        <Lead>The rate is set by the store each morning. Choose a karat, a weight and a making charge and see what a piece costs.</Lead>
        <div className={s.rategrid}>
          <div className={s.ratecard}>
            <span className={s.live}>Live rate, set by the store</span>
            <h3>Per gram, today</h3>
            {([24, 22, 18] as Karat[]).map((k) => (
              <div className={s.rr} key={k}>
                <small>{k} karat</small>
                <div>
                  <b>{show ? money(rates[k]) : "Ask us"}</b>
                  {show ? <em>/ g</em> : null}
                </div>
              </div>
            ))}
            <Note>
              Sample rates for this design. The owner updates them daily in the admin.
              {rate && settings?.showUpdatedAt !== false ? null : null}
            </Note>
          </div>
          <div className={s.calc}>
            <div>
              <Label>Karat</Label>
              <Chips label="Karat">
                {KARAT_CHIPS.map((k, i) => (
                  <Chip key={k} on={ki === i} onClick={() => setKi(i)}>
                    {k}k
                  </Chip>
                ))}
              </Chips>
            </div>
            <div>
              <Label>Weight</Label>
              <Stepper value={grams(gm)} label="Weight in grams" minusLabel="Less weight" plusLabel="More weight" canMinus={gm > 500} onMinus={() => setGm((g) => Math.max(500, g - 500))} onPlus={() => setGm((g) => g + 500)} />
            </div>
            <div>
              <Label>Making charge</Label>
              <Chips label="Making charge" scroll>
                {MAKING.map((m, i) => (
                  <Chip key={m} on={mi === i} onClick={() => setMi(i)}>
                    {m / 100}%
                  </Chip>
                ))}
              </Chips>
            </div>
            <dl className={s.brk} aria-live="polite">
              <div>
                <dt>Gold value</dt>
                <dd>{money(est.goldCents)}</dd>
              </div>
              <div>
                <dt>Making charge</dt>
                <dd>{money(est.makingCents)}</dd>
              </div>
              <div>
                <dt>HST 13%</dt>
                <dd>{money(est.hstCents)}</dd>
              </div>
              <div className={s.tt}>
                <dt>Estimate</dt>
                <dd>{money(est.totalCents)}</dd>
              </div>
            </dl>
            <Note>An estimate. Final price is confirmed on the scale in store. Stones are extra.</Note>
          </div>
        </div>
      </div>
    </section>
  );
}

const TILES = [
  { cat: "Earrings", sub: "Balis, tops, jhumka", img: "/images/jhumka.jpg", alt: "Gold jhumka earrings" },
  { cat: "Chains", sub: "Cuban, rope, daily wear", img: "/images/chain-cuban.jpg", alt: "Gold link chain" },
  { cat: "Bridal", sub: "Full sets and pendants", img: "/images/necklace-bust.jpg", alt: "Gold necklace set on a bust" },
  { cat: "Diamonds", sub: "Rings and moissanite", img: "/images/ring-solitaire.jpg", alt: "Solitaire ring" },
  { cat: "Bars", sub: "Investment gold", img: "/images/gold-bars.jpg", alt: "Gold bars", label: "Gold bars" },
];

export function Categories() {
  return (
    <section className={s.sec} id="collections" aria-labelledby="coll-title">
      <div className={s.wrap}>
        <Eyebrow>The collection</Eyebrow>
        <Heading>
          <span id="coll-title">
            Five ways <em>into gold.</em>
          </span>
        </Heading>
        <div className={s.cats}>
          {TILES.map((t) => (
            <Link key={t.cat} href={`/shop?cat=${t.cat}`} className={s.cat}>
              <div className={s.catArch}>
                <div className={s.catIn}>
                  <ProductImage src={t.img} alt={t.alt} sizes="(max-width: 899px) 45vw, 220px" />
                </div>
              </div>
              <b>{t.label ?? t.cat}</b>
              <span>{t.sub}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TradeInSection({ page }: { page?: boolean }) {
  const { rate24, settings } = usePricing();
  const { openVisit } = useSite();
  const [ki, setKi] = useState(1);
  const [gm, setGm] = useState(10000);
  const buyBps = Math.round((settings?.buyRatePct ?? 94) * 100);
  const t = tradeInValue(gm, KARAT_CHIPS[ki] as Karat, rate24, buyBps);
  return (
    <section className={`${s.sec} ${s.deep} dark`} id="tradein" aria-labelledby="trade-title">
      <div className={`${s.wrap} ${s.two}`}>
        <div>
          <Eyebrow>Old gold</Eyebrow>
          <Heading as={page ? "h1" : "h2"}>
            <span id="trade-title">
              Bring it in. <em>Trade it up.</em>
            </span>
          </Heading>
          <Lead>
            Get a feel for what your old jewellery is worth toward something new. {CLAIMS.testedInStore ? "We weigh and test everything in front of you before any number is final." : "Your piece is weighed in front of you and the final number is confirmed in store."}
            <Confirm why="Testing and weighing process statement. Confirm before it goes live." />
          </Lead>
          <div className={s.ctas}>
            <Button onClick={() => openVisit({ type: 5, valuation: { karat: KARAT_CHIPS[ki] as Karat, gramsMilli: gm } })}>Book a valuation</Button>
          </div>
        </div>
        <div className={s.tr2}>
          <div>
            <Label>Karat</Label>
            <Chips label="Karat">
              {KARAT_CHIPS.map((k, i) => (
                <Chip key={k} on={ki === i} onClick={() => setKi(i)}>
                  {k}k
                </Chip>
              ))}
            </Chips>
          </div>
          <div>
            <Label>Weight</Label>
            <Stepper value={grams(gm)} label="Weight in grams" minusLabel="Less weight" plusLabel="More weight" canMinus={gm > 500} onMinus={() => setGm((g) => Math.max(500, g - 500))} onPlus={() => setGm((g) => g + 500)} />
          </div>
          <dl className={s.brk} aria-live="polite">
            <div>
              <dt>Pure gold content</dt>
              <dd>{grams(t.pureGramsMilli, 2)}</dd>
            </div>
            <div>
              <dt>Buy rate</dt>
              <dd>{money(t.buyRateCents)} per gram</dd>
            </div>
            <div className={s.tt}>
              <dt>Trade-in estimate</dt>
              <dd>{money(t.valueCents)}</dd>
            </div>
          </dl>
          <Note>Estimate only, at a sample buy rate. Bring photo ID. Final value is confirmed in store.</Note>
        </div>
      </div>
    </section>
  );
}

const SERVICES: Array<{ icon: IconName; title: string; text: string; go: string; type: number }> = [
  { icon: "pencil", title: "Custom design", text: "Bring a picture or an idea. We sketch it, price it by weight and make it.", go: "Book a visit", type: 0 },
  { icon: "wrench", title: "Repairs and resizing", text: "Rings resized, chains mended, stones reset. Drop it in and get a ticket.", go: "Book a visit", type: 1 },
  { icon: "bars", title: "Gold bars", text: "10 g bars at the day's rate plus a small premium. Ask about coins.", go: "Book a visit", type: 2 },
  { icon: "card", title: "Layaway plan", text: "Reserve a piece with a deposit and pay it off in instalments.", go: "Ask us", type: 3 },
  { icon: "sparkle", title: "Cleaning and care", text: CLAIMS.ultrasonicClean ? "Ultrasonic clean and polish so your gold looks the way it did the day you bought it." : "Cleaning and polish so your gold looks the way it did the day you bought it.", go: "Ask us", type: 4 },
  { icon: "gift", title: "Gifts and occasions", text: "Weddings, Diwali, Karwa Chauth, baby gifts. Tell us the date and the budget.", go: "Talk to us", type: 0 },
];

export function Services() {
  const { openVisit } = useSite();
  return (
    <section className={`${s.sec} dark`} id="services" aria-labelledby="svc-title">
      <div className={s.wrap}>
        <Eyebrow>Services</Eyebrow>
        <Heading>
          <span id="svc-title">
            More than <em>a counter.</em>
          </span>
        </Heading>
        <div className={s.sv}>
          {SERVICES.map((v) => (
            <button key={v.title} type="button" className={s.svc} onClick={() => openVisit({ type: v.type })}>
              <Icon name={v.icon} size={30} strokeWidth={1.6} />
              <h3>{v.title}</h3>
              <p>{v.text}</p>
              <span className={s.go}>
                {v.go} <Icon name="arrow" size={16} strokeWidth={1.6} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Lookbook() {
  return (
    <section className={`${s.sec} ${s.deep} dark`} id="lookbook" aria-labelledby="lb-title">
      <div className={s.wrap}>
        <Eyebrow>The wedding edit</Eyebrow>
        <Heading>
          <span id="lb-title">
            Made for the <em>big days.</em>
          </span>
        </Heading>
        <div className={s.lb}>
          <figure className={s.lbBig}>
            <ProductImage src="/images/necklace-kundan.jpg" alt="Gold necklace with ruby drops and matching earrings" sizes="(max-width: 899px) 100vw, 40vw" />
            <figcaption>
              Antique gold and ruby<small>Necklace and earrings</small>
            </figcaption>
          </figure>
          <figure>
            <ProductImage src="/images/bangles-red.jpg" alt="Gold bangles with ruby stones" sizes="(max-width: 899px) 50vw, 25vw" />
            <figcaption>
              Ruby bangles<small>22k gold</small>
            </figcaption>
          </figure>
          <figure>
            <ProductImage src="/images/bridal-set.jpg" alt="Kundan choker set with pearls" sizes="(max-width: 899px) 50vw, 25vw" />
            <figcaption>
              Kundan choker<small>Pearl and emerald</small>
            </figcaption>
          </figure>
          <figure>
            <ProductImage src="/images/necklace-set-green.jpg" alt="Gold necklace and earrings on a green bust" sizes="(max-width: 899px) 50vw, 25vw" />
            <figcaption>
              Filigree set<small>Made to match</small>
            </figcaption>
          </figure>
          <figure>
            <ProductImage src="/images/gold-bars.jpg" alt="Gold bars" sizes="(max-width: 899px) 50vw, 25vw" />
            <figcaption>
              Investment gold<small>Bars at the day&apos;s rate</small>
            </figcaption>
          </figure>
        </div>
        <Note className="" >Placeholder photography until the store&apos;s own product photos are added.</Note>
      </div>
    </section>
  );
}

export function Story() {
  return (
    <section className={`${s.sec} cream`} id="story" aria-labelledby="story-title">
      <div className={`${s.wrap} ${s.story}`}>
        <div className={s.pos}>
          <div className={s.posImg}>
            <Image src="/images/poster.jpg" alt="Gold Mahal Jewellers grand opening poster" fill sizes="(max-width: 899px) 90vw, 420px" style={{ objectFit: "cover" }} />
          </div>
          <div className={s.st}>
            <ProductImage src="/images/store-display.jpg" alt="Jewellery display trays" sizes="180px" />
          </div>
        </div>
        <div>
          <Eyebrow>
            Our story
            <Confirm why="The opening poster comes from the store's Instagram. Get the owner's permission before launch." />
          </Eyebrow>
          <Heading>
            <span id="story-title">
              A new house for <em>Brampton gold.</em>
            </span>
          </Heading>
          <Lead>Gold Mahal opened its doors at Unit 27, 6121 Mayfield Road. We stand on three words: trust, purity and value. Gold that is what it says it is, at a price you can check yourself.</Lead>
          <Lead>From light everyday balis to full bridal sets, diamond rings and moissanite. Come in, ask anything, and weigh it with us.</Lead>
        </div>
      </div>
    </section>
  );
}

export function Reviews() {
  return (
    <section className={`${s.sec} ${s.deep} dark`} id="reviews" aria-labelledby="rev-title">
      <div className={s.wrap}>
        <Eyebrow>Reviews</Eyebrow>
        <Heading>
          <span id="rev-title">
            Five stars, <em>so far.</em>
          </span>
        </Heading>
        <div className={s.revs}>
          <div>
            <div className={`${s.bigNum} ${s.gradText}`}>5.0</div>
            <p className="" style={{ marginTop: 8, color: "var(--muted-dark)", fontSize: 18, maxWidth: 440 }}>
              On Google from 17 reviews.
              <Confirm why="Rating and count from Google Maps. Confirm they are current." /> Customers mention the collection, the jhumka earrings and friendly, knowledgeable service.
            </p>
          </div>
          <div className={`${s.th} cream`} style={{ background: "transparent" }}>
            <div>
              <b>Real reviews go here</b>We will show chosen Google reviews once the owner approves them. Nothing is invented.
            </div>
            <div>
              <b>Customer photos</b>Optional, with permission.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function VisitSection({ page }: { page?: boolean }) {
  const { settings } = usePricing();
  const { openVisit } = useSite();
  const rows = hoursRows((settings ?? defaultSettings()).hours);
  return (
    <section className={`${s.sec} dark`} id="visit" aria-labelledby="visit-title">
      <div className={`${s.wrap} ${s.vis}`}>
        <div>
          <Eyebrow>Visit</Eyebrow>
          <Heading as={page ? "h1" : "h2"}>
            <span id="visit-title">
              Mayfield Road, <em>Unit 27.</em>
            </span>
          </Heading>
          <p className={""} style={{ fontSize: 18, color: "var(--muted-dark)", margin: "18px 0 0" }}>
            {SHOP.address1}, {SHOP.address2}
            <Confirm why="Instagram caption lists 6201 Mayfield Rd, Unit 56. Confirm which is right." />
            <br />
            {SHOP.phone}
            <Confirm why="Instagram caption lists 647-291-2461. Confirm which number is right." />
          </p>
          <div className={s.hrs}>
            {rows.map((r) => (
              <div key={r.label} className={r.closed ? s.closed : undefined}>
                <span>{r.label}</span>
                <span>{r.value}</span>
              </div>
            ))}
          </div>
          <Note className="">
            Holiday hours to be confirmed.
            <Confirm why="Confirm holiday hours." />
          </Note>
          <div className={s.ctas}>
            <LinkButton href={SHOP.phoneHref}>Call the store</LinkButton>
            <Button variant="line" onClick={() => openVisit()}>
              Book a visit
            </Button>
          </div>
        </div>
        <div className={s.map}>
          <Icon name="pin" size={40} strokeWidth={1.6} />
          <strong>Gold Mahal Jewellers</strong>
          <span style={{ color: "var(--muted-dark)" }}>{SHOP.area}</span>
          <a className="" href="https://www.google.com/maps/search/?api=1&query=6121+Mayfield+Rd+%2327+Brampton+ON+L6P+4R9" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-bright)", textDecoration: "underline", textUnderlineOffset: 4, minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            Get directions (opens a map in a new tab)
          </a>
        </div>
      </div>
    </section>
  );
}
