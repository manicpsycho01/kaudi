import type { Metadata } from "next";
import { SeaApp } from "@/components/Apps";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "The sea", description: "The whole Kaudi network in free play: send coins, change hash power, cut lanes, bring the monsoon, mine in secret, forge blocks — and share the exact run." };

export default function SeaPage() {
  return (
    <>
      <SiteHeader current="/sea" />
      <main id="main"><SeaApp /></main>
    </>
  );
}
