import type { Metadata } from "next";
import { HeistApp } from "@/components/Apps";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "The heist", description: "Six classic ways to cheat a blockchain, run against a live network. Five get caught — by name. One works." };

export default function HeistPage() {
  return (
    <>
      <SiteHeader current="/heist" />
      <main id="main"><HeistApp /></main>
      <SiteFooter />
    </>
  );
}
