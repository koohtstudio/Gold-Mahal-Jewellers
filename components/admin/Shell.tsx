"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CloseButton, Dialog, Icon, useToast, type IconName } from "@/components/ui";
import { config } from "@/lib/config";
import { repo, useJobs, useMounted, useReservations, useSession } from "@/lib/hooks";
import { useSessionFlag } from "@/lib/hooks/ui";
import { usePricing } from "@/lib/hooks/pricing";
import { messageOf } from "@/lib/domain/errors";
import { money } from "@/lib/pricing";
import { Btn } from "./kit";
import s from "./admin.module.css";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  owner?: boolean;
  title: string;
  sub: string;
}

export const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", title: "Dashboard", sub: "Today at a glance" },
  { href: "/admin/rate", label: "Gold rate", icon: "rate", title: "Gold rate", sub: "Set the day's price. Every online price follows this" },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory", title: "Inventory", sub: "Every piece by weight. Tag, karat, net weight, making" },
  { href: "/admin/reservations", label: "Reservations", icon: "bag", title: "Reservations", sub: "Held for pickup. Prepare and hand over" },
  { href: "/admin/jobs", label: "Jobs", icon: "jobs", title: "Jobs", sub: "Custom orders and repairs, intake to ready" },
  { href: "/admin/old-gold", label: "Old gold", icon: "gold", title: "Old gold", sub: "Buying from customers. Weigh, test, record, pay" },
  { href: "/admin/layaway", label: "Layaway", icon: "layaway", title: "Layaway", sub: "Instalment plans, balances and payments" },
  { href: "/admin/books", label: "Books", icon: "books", owner: true, title: "Books", sub: "Sales, purchases and HST. Export or send to your accountant" },
  { href: "/admin/settings", label: "Settings", icon: "settings", owner: true, title: "Settings", sub: "Hold time, hours, texts and shop rules" },
];

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));

export function AdminShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const path = usePathname();
  const mounted = useMounted();
  useEffect(() => {
    // During hydration the session is unknown (null), so only redirect once the browser state has been read.
    if (mounted && session === null) router.replace(`/admin/login${path && path !== "/admin" ? `?next=${encodeURIComponent(path)}` : ""}`);
  }, [mounted, session, router, path]);
  if (!session) {
    return (
      <div className={s.login} role="status" aria-live="polite">
        <p style={{ color: "var(--gold-light)" }}>Opening the admin</p>
      </div>
    );
  }
  return (
    <Suspense fallback={null}>
      <ShellInner role={session.role} email={session.email}>
        {children}
      </ShellInner>
    </Suspense>
  );
}

function ShellInner({ role, email, children }: { role: "owner" | "staff"; email: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  void params;
  const [hidden, setHidden] = useSessionFlag("gm-banner");
  const [more, setMore] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { rates } = usePricing();
  const res = useReservations().data ?? [];
  const jobs = useJobs().data ?? [];
  const nNew = res.filter((r) => r.status === "new").length;
  const nJobs = jobs.filter((j) => j.stage !== "ready" && !j.closedAt).length;
  const items = NAV.filter((n) => !n.owner || role === "owner");
  const cur = NAV.find((n) => isActive(path, n.href)) ?? NAV[0]!;
  const demo = config.mode === "demo";

  async function signOut() {
    repo().ports.auth.signOut();
    router.replace("/admin/login");
  }
  async function doReset() {
    setResetting(true);
    try {
      await repo().reset();
      toast("Demo data reset. The sample pieces, reservations and books are back.");
      setResetOpen(false);
      setMore(false);
    } catch (e) {
      toast(messageOf(e), true);
    } finally {
      setResetting(false);
    }
  }
  const tabs: NavItem[] = role === "owner" ? ["/admin", "/admin/reservations", "/admin/inventory", "/admin/books"].map((h) => NAV.find((n) => n.href === h)!) : ["/admin", "/admin/reservations", "/admin/inventory", "/admin/jobs"].map((h) => NAV.find((n) => n.href === h)!);
  const moreItems = items.filter((n) => !tabs.includes(n));

  return (
    <div className={s.ad}>
      <aside className={s.sb} aria-label="Admin">
        <div className={s.lg}>
          <b>GOLD MAHAL</b>
          <small>Store admin</small>
        </div>
        <nav aria-label="Admin sections" style={{ display: "grid", gap: 2 }}>
          {items.map((n) => {
            const count = n.href === "/admin/reservations" ? nNew : n.href === "/admin/jobs" ? nJobs : 0;
            return (
              <div key={n.href} style={{ display: "contents" }}>
                {n.href === "/admin/books" ? <div className={s.sep} /> : null}
                <Link href={n.href} className={`${s.nv} ${isActive(path, n.href) ? s.nvOn : ""}`} aria-current={isActive(path, n.href) ? "page" : undefined}>
                  <Icon name={n.icon} />
                  {n.label}
                  {count > 0 ? (
                    <span className={s.ct} aria-label={`${count} waiting`}>
                      {count}
                    </span>
                  ) : null}
                </Link>
              </div>
            );
          })}
        </nav>
        <div className={s.me}>
          <div className={s.meRow}>
            <div className={s.av} aria-hidden="true">
              {role === "owner" ? "O" : "S"}
            </div>
            <div>
              {role === "owner" ? "Store owner" : "Counter staff"}
              <br />
              <small style={{ color: "#a39679" }}>{email}</small>
            </div>
          </div>
          <button type="button" className={s.meBtn} onClick={() => setResetOpen(true)}>
            <Icon name="reset" size={16} /> Reset demo data
          </button>
          <button type="button" className={s.meBtn} onClick={signOut}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className={s.main}>
        {!hidden ? (
          <div className={s.banner} role="note">
            <span>{demo ? "Design preview. Sample data. Changes are shared with everyone who opens this demo link. " : "Design preview. Sample data. Changes stay in this browser. "}Nothing is charged, texted, emailed or sent to an accountant.</span>
            <button type="button" onClick={() => setHidden(true)}>
              Dismiss
            </button>
          </div>
        ) : null}
        <header className={s.top}>
          <div>
            <h1>{cur.title}</h1>
            <p>{cur.sub}</p>
          </div>
          <div className={s.topActions}>
            <Link href="/admin/rate" className={s.rchip}>
              22k today <b>{money(rates[22])}/g</b>
            </Link>
            {role === "owner" ? (
              <Link href="/admin/books" className={`${s.btn} ${s.btnGold}`}>
                Books
              </Link>
            ) : null}
          </div>
        </header>
        <main id="main" className={s.body}>
          {children}
        </main>
      </div>

      <nav className={s.tabbar} aria-label="Admin tabs">
        {tabs.map((n) => (
          <Link key={n.href} href={n.href} className={isActive(path, n.href) ? "on" : undefined} aria-current={isActive(path, n.href) ? "page" : undefined}>
            <Icon name={n.icon} size={22} />
            {n.label}
            {n.href === "/admin/reservations" && nNew > 0 ? <span className={s.badge}>{nNew}</span> : null}
          </Link>
        ))}
        <button type="button" onClick={() => setMore(true)} className={moreItems.some((n) => isActive(path, n.href)) ? "on" : undefined} aria-haspopup="dialog">
          <Icon name="more" size={22} />
          More
        </button>
      </nav>

      <Dialog open={more} onClose={() => setMore(false)} label="More">
        <div className={s.sheetBody} style={{ width: "min(100vw, 520px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ font: "500 28px var(--font-display)", margin: 0 }}>More</h2>
            <CloseButton onClick={() => setMore(false)} />
          </div>
          {moreItems.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setMore(false)}>
              <Icon name={n.icon} /> {n.label}
            </Link>
          ))}
          <button type="button" className="sheetLink" onClick={() => (setMore(false), setResetOpen(true))} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "0 12px", border: "1px solid #d8cba8", background: "#fff", fontSize: 15, cursor: "pointer" }}>
            <Icon name="reset" /> Reset demo data
          </button>
          <button type="button" onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 52, padding: "0 12px", border: "1px solid #d8cba8", background: "#fff", fontSize: 15, cursor: "pointer" }}>
            <Icon name="logout" /> Sign out
          </button>
        </div>
      </Dialog>

      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} label="Reset demo data">
        <div className={s.sheetBody} style={{ width: "min(100vw, 480px)", gap: 16 }}>
          <h2 style={{ font: "500 28px var(--font-display)", margin: 0 }}>Reset demo data?</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>
            This puts back the sample pieces, reservations, jobs and books. Anything you added or changed is removed.{demo ? " Everyone using this demo link will see the reset." : ""}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn onClick={doReset} disabled={resetting}>
              {resetting ? "Resetting" : "Yes, reset"}
            </Btn>
            <Btn variant="line" onClick={() => setResetOpen(false)}>
              Cancel
            </Btn>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
