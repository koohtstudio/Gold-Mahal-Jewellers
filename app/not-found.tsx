import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", background: "var(--velvet)" }}>
      <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        <p style={{ font: "500 12px var(--font-body)", letterSpacing: ".34em", textTransform: "uppercase", color: "var(--gold)", margin: 0 }}>404</p>
        <h1 style={{ font: "500 56px/1 var(--font-display)", margin: 0 }}>That page is not in the case.</h1>
        <p style={{ color: "var(--muted-dark)", maxWidth: 420, margin: 0 }}>The link may be old. Let us get you back to something shiny.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <LinkButton href="/">Home</LinkButton>
          <LinkButton href="/shop" variant="line">
            Shop
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
