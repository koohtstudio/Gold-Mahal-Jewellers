"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui";
import { repo } from "@/lib/hooks";
import type { Role } from "@/lib/domain/schemas";
import { Btn } from "./kit";
import s from "./admin.module.css";

export function LoginCard() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const go = (role: Role) => {
    repo().ports.auth.signIn(role);
    router.replace(next && next.startsWith("/admin") ? next : "/admin");
  };
  return (
    <div className={s.login}>
      <main id="main" className={s.loginCard}>
        <div>
          <span style={{ font: "600 22px var(--font-display)", letterSpacing: ".2em", color: "var(--gold-dark)" }}>GOLD MAHAL</span>
        </div>
        <h1>Store admin</h1>
        <p>This is a design preview with sample data. Pick a demo account to look around. No password is needed.</p>
        <Btn onClick={() => go("owner")}>
          <Icon name="settings" size={16} /> Continue as the owner
        </Btn>
        <p style={{ fontSize: 13, marginTop: -8 }}>The owner sees everything: gold rate, books, settings and old gold ID references.</p>
        <Btn variant="line" onClick={() => go("staff")}>
          Continue as counter staff
        </Btn>
        <p style={{ fontSize: 13, marginTop: -8 }}>Counter staff handle reservations, inventory, jobs, old gold and layaway. They cannot see the books, settings or ID references, or change the rate.</p>
      </main>
    </div>
  );
}
