import type { Metadata, Viewport } from "next";
import { Azeret_Mono, Marcellus, STIX_Two_Text } from "next/font/google";
import { SmoothScroll } from "@/components/SmoothScroll";
import "./globals.css";

const marcellus = Marcellus({ subsets: ["latin"], weight: "400", variable: "--font-marcellus" });
const stix = STIX_Two_Text({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-stix" });
const azeret = Azeret_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-azeret" });

const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3500";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: { default: "Kaudi — a blockchain you can watch", template: "%s · Kaudi" },
  description:
    "A coin and blockchain built from scratch — real SHA-256 proof of work, Schnorr signatures and UTXOs — running as a live network of Indian Ocean ports in your browser. Send coins, split the sea, watch forks resolve, try a double spend.",
  openGraph: { title: "Kaudi", description: "A blockchain built from scratch, running live in your browser. Watch every block cross the sea.", type: "website" },
};

export const viewport: Viewport = { themeColor: "#08131f", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${marcellus.variable} ${stix.variable} ${azeret.variable}`}>
      <body>
        <a href="#main" className="label fixed top-3 left-3 z-50 -translate-y-24 bg-ink px-4 py-3 text-sea focus-visible:translate-y-0">
          Skip to content
        </a>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
