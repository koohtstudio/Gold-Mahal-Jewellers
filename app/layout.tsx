import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { headers } from "next/headers";
import { config } from "@/lib/config";
import "../styles/tokens.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
const body = Jost({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-jost", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl || "http://localhost:3000"),
  title: { default: "Gold Mahal Jewellers | 22k gold, diamonds and moissanite in Brampton", template: "%s | Gold Mahal Jewellers" },
  description: "Gold jewellery priced by the gram at today's rate. See the maths on every piece, reserve online and pick up in store at Mayfield Road, Brampton. Sample prices.",
  robots: config.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: { siteName: "Gold Mahal Jewellers", type: "website", locale: "en_CA" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: "#14100c", width: "device-width", initialScale: 1, colorScheme: "dark" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request headers makes every page render per request, which the nonce based CSP needs.
  await headers();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          Skip to the content
        </a>
        {children}
      </body>
    </html>
  );
}
