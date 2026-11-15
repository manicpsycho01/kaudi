import { Landing } from "@/components/Landing";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";

export default function Home() {
  return (
    <>
      <SiteHeader current="/" />
      <main id="main"><Landing /></main>
      <SiteFooter />
    </>
  );
}
