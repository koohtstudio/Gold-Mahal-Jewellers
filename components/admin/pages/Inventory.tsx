"use client";

import { useState } from "react";
import { CloseButton, Dialog, Pill, ProductImage } from "@/components/ui";
import { CATEGORIES } from "@/lib/domain/constants";
import type { Category, Karat, Piece } from "@/lib/domain/schemas";
import { repo, useAllPieces } from "@/lib/hooks";
import { usePricing } from "@/lib/hooks/pricing";
import { availableUnits, grams, hstOn, money, parseCents, parseMilli, pieceStatus } from "@/lib/pricing";
import { AField, Btn, Card, Empty, QueryView, Table, Tabs, Toggle, useRun } from "../kit";
import s from "../admin.module.css";

const PHOTOS: Array<[string, string]> = [
  ["/images/hoops.jpg", "Hoops"], ["/images/studs.jpg", "Studs"], ["/images/jhumka.jpg", "Jhumka"], ["/images/chain-cuban.jpg", "Cuban chain"], ["/images/necklace-bust.jpg", "Necklace on bust"],
  ["/images/necklace-set-green.jpg", "Necklace set, green"], ["/images/necklace-kundan.jpg", "Kundan necklace"], ["/images/bridal-set.jpg", "Bridal choker set"], ["/images/bangles-red.jpg", "Red bangles"],
  ["/images/ring-solitaire.jpg", "Solitaire ring"], ["/images/ring-pear.jpg", "Pear ring"], ["/images/bracelet-diamond.jpg", "Bracelet"], ["/images/gold-bars.jpg", "Gold bars"], ["/images/hero-jhumka.jpg", "Jhumka pair on cloth"],
];

type Tab = "all" | "in_case" | "reserved" | "sold" | "hidden";
const STATUS_TONE = { in_case: "ok", reserved: "new", sold: "sold" } as const;
const STATUS_LABEL = { in_case: "In case", reserved: "Reserved", sold: "Sold" } as const;

export function InventoryPage() {
  const q = useAllPieces();
  const { price } = usePricing();
  const [tab, setTab] = useState<Tab>("all");
  const [edit, setEdit] = useState<Piece | null>(null);
  const [sell, setSell] = useState<Piece | null>(null);
  const [tag, setTag] = useState<Piece | null>(null);
  const pieces = q.data ?? [];
  const count = (t: Tab) => pieces.filter((p) => matches(p, t)).length;
  const rows = pieces.filter((p) => matches(p, tab));
  return (
    <>
      <Tabs
        label="Filter inventory"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "all", label: "All", count: count("all") },
          { key: "in_case", label: "In case", count: count("in_case") },
          { key: "reserved", label: "Reserved", count: count("reserved") },
          { key: "sold", label: "Sold", count: count("sold") },
          { key: "hidden", label: "Not listed online", count: count("hidden") },
        ]}
      />
      <Card>
        <QueryView q={q} isEmpty={(d) => d.length === 0} empty={<Empty title="No pieces yet" text="Add your first piece below." />}>
          {() =>
            rows.length === 0 ? (
              <Empty title="Nothing in this tab" text="Pieces move here as they are reserved, sold or hidden." />
            ) : (
              <Table label="Inventory">
                <thead>
                  <tr>
                    <th>Tag</th>
                    <th>Piece</th>
                    <th>Kt</th>
                    <th className={s.r}>Net g</th>
                    <th className={s.r}>Mk %</th>
                    <th className={s.r}>Stone</th>
                    <th className={s.r}>Price now</th>
                    <th>Units</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const st = pieceStatus(p);
                    const parts = price(p);
                    return (
                      <tr key={p.id}>
                        <td>{p.tag}</td>
                        <td>
                          {p.name}
                          {!p.visible ? (
                            <>
                              {" "}
                              <Pill>Not listed</Pill>
                            </>
                          ) : null}
                        </td>
                        <td>{p.karat ? `${p.karat}k` : "Silver"}</td>
                        <td className={s.r}>{p.karat ? (p.netGramsMilli / 1000).toFixed(1) : "-"}</td>
                        <td className={s.r}>{p.karat ? (parts.makingBps / 100).toFixed(parts.makingBps % 100 ? 1 : 0) : "-"}</td>
                        <td className={s.r}>{p.stoneCents ? money(p.stoneCents) : "-"}</td>
                        <td className={s.r}>{money(parts.totalCents)}</td>
                        <td>
                          {availableUnits(p)}/{p.units}
                        </td>
                        <td>
                          <Pill tone={STATUS_TONE[st]}>{STATUS_LABEL[st]}</Pill>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 6 }}>
                            <Btn small variant="line" onClick={() => setEdit(p)} aria-label={`Edit ${p.name}`}>
                              Edit
                            </Btn>
                            <Btn small variant="line" disabled={availableUnits(p) < 1} onClick={() => setSell(p)} aria-label={`Sell ${p.name} at the counter`}>
                              Sell
                            </Btn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )
          }
        </QueryView>
        <p className={s.note}>Price now = net weight x today&apos;s rate x (1 + making) + stone. Gold bars use the bar premium from the Gold rate page.</p>
      </Card>
      <AddPiece onAdded={setTag} />
      <EditDialog piece={edit} onClose={() => setEdit(null)} />
      <SellDialog piece={sell} onClose={() => setSell(null)} />
      <TagDialog piece={tag} onClose={() => setTag(null)} />
    </>
  );
}

function matches(p: Piece, t: Tab) {
  if (t === "all") return true;
  if (t === "hidden") return !p.visible;
  return pieceStatus(p) === t;
}

function Thumb({ src, name }: { src: string; name: string }) {
  return (
    <div style={{ position: "relative", width: 64, height: 64, border: "1px solid #c4b58e", background: "#14100c", overflow: "hidden" }}>
      <ProductImage src={src} alt={`Photo of ${name || "the piece"}`} sizes="64px" />
    </div>
  );
}

function ImagePicker({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  const { run } = useRun();
  const isUpload = value.startsWith("idb:");
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Thumb src={value} name={name} />
        <AField label="Photo" hint="Stock photos are placeholders until you add your own.">
          {(p) => (
            <select {...p} value={isUpload ? "upload" : value} onChange={(e) => e.target.value !== "upload" && onChange(e.target.value)}>
              {PHOTOS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
              {isUpload ? <option value="upload">Your uploaded photo</option> : null}
            </select>
          )}
        </AField>
      </div>
      <AField label="Or upload your own photo" hint="Saved on this device in the preview. The live version stores it with the shop.">
        {(p) => (
          <input
            {...p}
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const ref = await run(() => repo().ports.storage.put(f, "piece"), "Photo added.");
              if (ref) onChange(ref);
            }}
          />
        )}
      </AField>
    </div>
  );
}

function AddPiece({ onAdded }: { onAdded: (p: Piece) => void }) {
  const { settings } = usePricing();
  const { run, busy } = useRun();
  const [name, setName] = useState("");
  const [cat, setCat] = useState<Category>("Earrings");
  const [karat, setKarat] = useState<string>("22");
  const [w, setW] = useState("");
  const [mk, setMk] = useState("");
  const [stone, setStone] = useState("");
  const [fixed, setFixed] = useState("");
  const [units, setUnits] = useState("1");
  const [cert, setCert] = useState("");
  const [image, setImage] = useState("/images/hoops.jpg");
  const [touched, setTouched] = useState(false);

  const isFixed = karat === "silver";
  const defaultMk = settings ? settings.defaultMakingBps[cat] / 100 : 8;
  const gMilli = parseMilli(w);
  const mkBps = mk.trim() === "" ? Math.round(defaultMk * 100) : Math.round(Number(mk.replace(/[^0-9.]/g, "")) * 100);
  const stoneC = stone.trim() === "" ? 0 : parseCents(stone);
  const fixedC = parseCents(fixed);
  const unitsN = Number(units);
  const errs = {
    name: name.trim().length < 3 ? "Give the piece a name." : null,
    w: !isFixed && (gMilli === null || gMilli <= 0) ? "Enter the net weight in grams." : null,
    fixed: isFixed && (fixedC === null || fixedC <= 0) ? "Enter the fixed price." : null,
    units: !Number.isInteger(unitsN) || unitsN < 1 ? "Enter how many." : null,
  };
  const bad = Object.values(errs).some(Boolean) || mkBps < 0 || mkBps > 10000 || stoneC === null;

  async function add() {
    setTouched(true);
    if (bad) return;
    const p = await run(
      () =>
        repo().pieces.add({
          name, category: cat, karat: isFixed ? null : (Number(karat) as Karat), netGramsMilli: isFixed ? 0 : (gMilli as number), makingBps: isFixed ? 0 : mkBps, stoneCents: stoneC ?? 0,
          ...(isFixed ? { fixedCents: fixedC as number } : {}), units: unitsN, image, ...(cert.trim() ? { certificateRef: cert.trim() } : {}),
        }),
      (x) => `Added ${x.tag}. Tag sent to the label printer (preview).`,
    );
    if (p) {
      onAdded(p);
      setName("");
      setW("");
      setMk("");
      setStone("");
      setFixed("");
      setUnits("1");
      setCert("");
      setTouched(false);
    }
  }

  return (
    <Card title="Add a piece">
      <form
        className={s.stack}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <div className={s.ex}>
          <AField label="Name" error={touched ? errs.name : null}>
            {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="22k gold bangle" />}
          </AField>
          <AField label="Category">
            {(p) => (
              <select {...p} value={cat} onChange={(e) => setCat(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </AField>
          <AField label="Karat">
            {(p) => (
              <select {...p} value={karat} onChange={(e) => setKarat(e.target.value)}>
                {["22", "24", "18", "14"].map((k) => (
                  <option key={k} value={k}>
                    {k}k
                  </option>
                ))}
                <option value="silver">Silver, fixed price</option>
              </select>
            )}
          </AField>
        </div>
        {isFixed ? (
          <div className={s.ex}>
            <AField label="Fixed price ($)" error={touched ? errs.fixed : null}>
              {(p) => <input {...p} inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="650" />}
            </AField>
            <AField label="Units" error={touched ? errs.units : null}>
              {(p) => <input {...p} inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} />}
            </AField>
          </div>
        ) : (
          <div className={s.ex}>
            <AField label="Net weight (g)" error={touched ? errs.w : null}>
              {(p) => <input {...p} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} placeholder="12.4" />}
            </AField>
            <AField label="Making charge (%)" hint={`Default for ${cat}: ${defaultMk}%`}>
              {(p) => <input {...p} inputMode="decimal" value={mk} onChange={(e) => setMk(e.target.value)} placeholder={String(defaultMk)} />}
            </AField>
            <AField label="Stone value ($)">{(p) => <input {...p} inputMode="decimal" value={stone} onChange={(e) => setStone(e.target.value)} placeholder="0" />}</AField>
            <AField label="Units" error={touched ? errs.units : null}>
              {(p) => <input {...p} inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} />}
            </AField>
          </div>
        )}
        {cat === "Diamonds" ? (
          <AField label="Certificate reference" hint="For diamonds and moissanite. Shown on the tag.">
            {(p) => <input {...p} value={cert} onChange={(e) => setCert(e.target.value)} placeholder="Lab and number" />}
          </AField>
        ) : null}
        <ImagePicker value={image} onChange={setImage} name={name} />
        <div>
          <Btn type="submit" disabled={busy}>
            Add and print tag
          </Btn>
        </div>
      </form>
    </Card>
  );
}

function EditDialog({ piece, onClose }: { piece: Piece | null; onClose: () => void }) {
  return (
    <Dialog open={!!piece} onClose={onClose} label="Edit piece">
      {piece ? <EditForm key={piece.id} piece={piece} onClose={onClose} /> : null}
    </Dialog>
  );
}

function EditForm({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  const { run, busy } = useRun();
  const [image, setImage] = useState(piece.image);
  const [visible, setVisible] = useState(piece.visible);
  const [units, setUnits] = useState(String(piece.units));
  const [cert, setCert] = useState(piece.certificateRef ?? "");
  const [desc, setDesc] = useState(piece.description);
  return (
    <div className={s.sheetBody} style={{ width: "min(100vw, 560px)", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ font: "500 28px var(--font-display)", margin: 0 }}>
          {piece.tag} · {piece.name}
        </h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className={s.sw}>
        <div>
          <b style={{ fontWeight: 500 }}>Listed on the website</b>
          <small>Turn off to hide the piece from customers</small>
        </div>
        <Toggle on={visible} onChange={setVisible} label="Listed on the website" />
      </div>
      <AField label="Units in stock" hint={`${piece.unitsReserved} on hold, ${piece.unitsSold} sold`}>
        {(p) => <input {...p} inputMode="numeric" value={units} onChange={(e) => setUnits(e.target.value)} />}
      </AField>
      <AField label="Description">{(p) => <input {...p} value={desc} onChange={(e) => setDesc(e.target.value)} />}</AField>
      {piece.category === "Diamonds" ? <AField label="Certificate reference">{(p) => <input {...p} value={cert} onChange={(e) => setCert(e.target.value)} />}</AField> : null}
      <ImagePicker value={image} onChange={setImage} name={piece.name} />
      <div style={{ display: "flex", gap: 10 }}>
        <Btn
          disabled={busy}
          onClick={async () => {
            const n = Number(units);
            if (!Number.isInteger(n) || n < 0) return;
            const ok = await run(() => repo().pieces.update(piece.id, { visible, image, units: n, description: desc, certificateRef: cert }), `${piece.tag} saved.`);
            if (ok) onClose();
          }}
        >
          Save changes
        </Btn>
        <Btn variant="line" onClick={onClose}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

function SellDialog({ piece, onClose }: { piece: Piece | null; onClose: () => void }) {
  return (
    <Dialog open={!!piece} onClose={onClose} label="Sell at the counter">
      {piece ? <SellForm piece={piece} onClose={onClose} /> : null}
    </Dialog>
  );
}

function SellForm({ piece, onClose }: { piece: Piece; onClose: () => void }) {
  const { price } = usePricing();
  const { run, busy } = useRun();
  const [who, setWho] = useState("");
  const net = price(piece).totalCents;
  const hst = piece.taxFree ? 0 : hstOn(net);
  return (
    <div className={s.sheetBody} style={{ width: "min(100vw, 480px)", gap: 14 }}>
      <h2 style={{ font: "500 28px var(--font-display)", margin: 0 }}>Sell at the counter</h2>
      <p style={{ margin: 0 }}>
        {piece.tag} · {piece.name}
      </p>
      <dl className={s.kv}>
        <dt>Price</dt>
        <dd>{money(net)}</dd>
        <dt>HST</dt>
        <dd>{piece.taxFree ? "Exempt (confirm with accountant)" : money(hst)}</dd>
        <dt>Total</dt>
        <dd>{money(net + hst)}</dd>
      </dl>
      <AField label="Customer (optional)">{(p) => <input {...p} value={who} onChange={(e) => setWho(e.target.value)} placeholder="Walk in" />}</AField>
      <div style={{ display: "flex", gap: 10 }}>
        <Btn
          disabled={busy}
          onClick={async () => {
            const r = await run(() => repo().pieces.sellAtCounter(piece.id, { customer: who }), "Sold. Added to the sales ledger.");
            if (r) onClose();
          }}
        >
          Record the sale
        </Btn>
        <Btn variant="line" onClick={onClose}>
          Cancel
        </Btn>
      </div>
    </div>
  );
}

function TagDialog({ piece, onClose }: { piece: Piece | null; onClose: () => void }) {
  const { price } = usePricing();
  const parts = piece ? price(piece) : null;
  return (
    <Dialog open={!!piece} onClose={onClose} label="Price tag preview">
      {piece && parts ? (
        <div className={s.sheetBody} style={{ width: "min(100vw, 360px)", justifyItems: "center", gap: 14 }}>
          <h2 style={{ font: "500 24px var(--font-display)", margin: 0 }}>Tag sent to the printer</h2>
          <div className={s.tag}>
            <b>{piece.tag}</b>
            <span>{piece.name}</span>
            <span>
              {piece.karat ? `${piece.karat}k` : "Silver"} · {grams(piece.netGramsMilli)}
            </span>
            {piece.certificateRef ? <span>Cert: {piece.certificateRef}</span> : null}
            <span style={{ font: "500 22px var(--font-display)" }}>{money(parts.totalCents)}</span>
          </div>
          <p className={s.note}>Preview only. No printer is connected in this design.</p>
          <Btn onClick={onClose}>Done</Btn>
        </div>
      ) : null}
    </Dialog>
  );
}

