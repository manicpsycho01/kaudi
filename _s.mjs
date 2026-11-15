import { chromium } from "@playwright/test";
setTimeout(() => { console.log("HARD TIMEOUT"); process.exit(1); }, 280000);
const o = process.argv[2];
const pages = ["/", "/heist", "/sea", "/voyages", "/voyages/the-broken-cowrie", "/voyages/keys-and-seals", "/voyages/counting-shells", "/voyages/the-race", "/voyages/the-monsoon", "/voyages/the-corsair", "/voyages/proof-in-a-pocket", "/rules", "/real"];
const b = await chromium.launch();
for (const [w, h, m] of [[1440, 900, 0], [390, 844, 1]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m });
  for (const path of pages) {
    const p = await ctx.newPage();
    const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (c) => c.type() === "error" && errs.push(c.text()));
    await p.goto("http://localhost:3500" + path, { waitUntil: "load" }); await p.waitForTimeout(5000);
    const name = (path === "/" ? "home" : path.slice(1).replace(/\//g, "_")) + "-" + w;
    await p.screenshot({ path: `${o}/${name}.png`, fullPage: true });
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(name, "overflow", ov, "errors", errs.length ? errs.slice(0, 3).join(" | ") : "none");
    await p.close();
  }
}
await b.close(); process.exit(0);
