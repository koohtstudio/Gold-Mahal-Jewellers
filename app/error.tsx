"use client";

import { Button } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", background: "var(--velvet)" }}>
      <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        <h1 style={{ font: "500 48px/1 var(--font-display)", margin: 0 }}>Something went wrong.</h1>
        <p style={{ color: "var(--muted-dark)", maxWidth: 420, margin: 0 }}>Nothing was lost. Please try again, and call the store if it keeps happening.</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
