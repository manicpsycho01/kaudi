import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/", "/start", "/heist", "/sea", "/voyages", "/voyages/the-broken-cowrie", "/voyages/keys-and-seals", "/voyages/counting-shells", "/voyages/the-race", "/voyages/the-monsoon", "/voyages/the-corsair", "/voyages/proof-in-a-pocket", "/rules", "/real"];

function watch(page: Page) {
  const errs: string[] = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  return errs;
}
const fast = (page: Page) => page.getByRole("radio", { name: "16×" }).first().click();

for (const path of PAGES) {
  test(`${path} loads cleanly with one h1 and no sideways scroll`, async ({ page }) => {
    const errs = watch(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    expect(errs).toEqual([]);
  });
}

test("home: tells why it exists, who it's for, and leads with the heist", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Watch it agree. Then try to rob it.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /understand it, not just use it/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who it's for" })).toBeVisible();
  await page.getByRole("link", { name: "Try to rob it" }).first().click();
  await expect(page).toHaveURL(/\/heist$/);
});

test("start here: the simple story covers the steps, the rules and what's pretend", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Start here — the five-minute story/ }).click();
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole("heading", { name: "How a payment happens" })).toBeVisible();
  await expect(page.locator("main ol > li")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "The rules every town checks" })).toBeVisible();
  await expect(page.getByText("Most work wins")).toBeVisible();
  await expect(page.getByText("Pretend", { exact: true })).toBeVisible();
});

test("the network runs: blocks get mined and appear in the tree", async ({ page }) => {
  await page.goto("/sea");
  await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
  const before = await page.locator("[data-block]").count();
  await fast(page);
  await expect.poll(() => page.locator("[data-block]").count(), { timeout: 40_000 }).toBeGreaterThan(before);
});

test("sea: a payment is accepted, sails out and gets confirmed", async ({ page }) => {
  await page.goto("/sea");
  await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sent." })).toBeVisible();
  await fast(page);
  const asha = page.getByRole("row", { name: /^Asha/ });
  await expect(asha.getByRole("cell").nth(2)).toHaveText("94.999", { timeout: 60_000 });
});

test("sea: a forged block is refused by name", async ({ page }) => {
  await page.goto("/sea");
  await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Ports" }).click();
  await page.getByRole("button", { name: "Broadcast" }).click();
  await page.getByRole("tab", { name: "Log" }).click();
  await expect(page.getByText(/rejected block .*: The coinbase may pay out at most/).first()).toBeVisible({ timeout: 20_000 });
});

test("share: a shared run replays the same events at the same moments", async ({ page, browser, context }, info) => {
  test.skip(info.project.name !== "desktop", "once");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/sea");
  await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sent." })).toBeVisible();
  await page.getByRole("button", { name: "Share this run" }).click();
  await expect(page.getByText("Link copied")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/sea\?run=/);
  await page.getByRole("tab", { name: "Log" }).click();
  const original = (await page.getByRole("listitem").filter({ hasText: "Asha sends 5 KAUDI" }).first().innerText()).replace(/\s+/g, " ");

  const other = await (await browser.newContext()).newPage();
  await other.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(other.getByText("You're watching a shared run")).toBeVisible();
  await other.getByRole("radio", { name: "4×" }).click();
  await other.getByRole("tab", { name: "Log" }).click();
  const replayed = other.getByRole("listitem").filter({ hasText: "Asha sends 5 KAUDI" }).first();
  await expect(replayed).toBeVisible({ timeout: 40_000 });
  expect((await replayed.innerText()).replace(/\s+/g, " ")).toBe(original);
});

test.describe("heist", () => {
  test.skip(({ isMobile }) => isMobile, "long-running; desktop only");
  for (const [id, label] of [["print", "Print money"], ["pick", "Pickpocket"], ["lazy", "Skip the work"], ["rewrite", "Rewrite history"]] as const) {
    test(`${label} gets caught, naming the ports and the rule`, async ({ page }) => {
      await page.goto("/heist");
      await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
      const card = page.locator(`[data-trick=${id}]`);
      await card.getByRole("button", { name: "Try it" }).click();
      await expect(card).toHaveAttribute("data-state", "caught", { timeout: 30_000 });
      await expect(card.getByText(/^Caught by /)).toBeVisible();
    });
  }
  test("Pay twice: only one of the two payments survives", async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto("/heist");
    await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
    await fast(page);
    const card = page.locator("[data-trick=twice]");
    await card.getByRole("button", { name: "Try it" }).click();
    await expect(card).toHaveAttribute("data-state", "caught", { timeout: 200_000 });
    await expect(card.getByText(/got paid, and every port refused/)).toBeVisible();
  });
  test("Outmine everyone: the one trick that works", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/heist");
    await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
    const card = page.locator("[data-trick=outmine]");
    await card.getByRole("button", { name: "Try it" }).click();
    await fast(page);
    await expect(card).toHaveAttribute("data-state", "worked", { timeout: 260_000 });
    await expect(page.getByTestId("score")).toContainText("1 worked");
  });
});

test("voyage 1: tampering breaks the block and everything after it; re-mining fixes the work but not the signature", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/voyages/the-broken-cowrie");
  await page.getByLabel("Type anything").fill("Asha pays Bilal 6 KAUDI");
  await expect(page.getByText(/of 64 characters changed/)).toBeVisible();
  const b1 = page.getByTestId("mini-1"), b2 = page.getByTestId("mini-2");
  await expect(b1).toHaveAttribute("data-ok", "true", { timeout: 30_000 });
  await b1.getByRole("textbox").fill("50");
  await expect(b1).toHaveAttribute("data-ok", "false");
  await expect(b2).toHaveAttribute("data-ok", "false");
  await b1.getByRole("button", { name: "Re-mine this block" }).click();
  await expect(b1).toHaveAttribute("data-ok", "true", { timeout: 60_000 });
  await expect(b1.getByText("✗ payer's signature matches")).toBeVisible();
  await expect(b2).toHaveAttribute("data-ok", "false");
});

test("voyage 2: a signature checks out, breaks when the message changes, and can't spend someone else's coin", async ({ page }) => {
  await page.goto("/voyages/keys-and-seals");
  await page.getByRole("button", { name: "Make me a key" }).click();
  await expect(page.getByText(/^kd1[02-9ac-hj-np-z]{38}$/)).toBeVisible();
  await page.getByRole("button", { name: "Sign it" }).click();
  await expect(page.getByTestId("verdict")).toContainText("Valid");
  await page.getByLabel("Message").fill("I, the owner of this key, pay Bilal 500 KAUDI.");
  await expect(page.getByTestId("verdict")).toContainText("message changed");
  await page.getByRole("button", { name: "Sign with your own key" }).click();
  await page.getByRole("button", { name: "Use her public key, your signature" }).click();
  await expect(page.getByTestId("theft")).toHaveCount(2);
  await expect(page.getByTestId("theft").nth(0)).toContainText("tx-wrong-owner");
  await expect(page.getByTestId("theft").nth(1)).toContainText("tx-bad-signature");
});

test("voyage 3: spending coins makes change; spending one twice is refused", async ({ page }) => {
  await page.goto("/voyages/counting-shells");
  const coin40 = page.getByRole("checkbox", { name: /^40 KAUDI/ });
  await expect(coin40).toBeVisible({ timeout: 30_000 });
  await coin40.check();
  await expect(page.getByTestId("fee")).toHaveText("0.001");
  await page.getByRole("button", { name: "Sign and check" }).click();
  await expect(page.getByText(/✓ Valid\. Fee 0\.001 KAUDI/)).toBeVisible();
  await page.getByRole("checkbox", { name: /^40 KAUDI/ }).check();
  await page.getByRole("button", { name: "Sign and check" }).click();
  await expect(page.getByTestId("reject")).toContainText("very same payment");
  await page.getByLabel("To Bilal (KAUDI)").fill("31");
  await page.getByRole("button", { name: "Sign and check" }).click();
  await expect(page.getByTestId("reject")).toContainText("tx-conflict");
});

test("voyage 7: a three-hash proof verifies, and a lie doesn't", async ({ page }) => {
  await page.goto("/voyages/proof-in-a-pocket");
  await expect(page.getByTestId("merkle-verdict")).toContainText("Match", { timeout: 30_000 });
  await page.getByRole("button", { name: /^Transaction 6/ }).click();
  await expect(page.getByTestId("merkle-verdict")).toContainText("Match");
  await page.getByRole("checkbox", { name: /Lie about it/ }).check();
  await expect(page.getByTestId("merkle-verdict")).toContainText("No match");
});

test.describe("network voyages", () => {
  test.skip(({ isMobile }) => isMobile, "long-running; desktop only");
  test("voyage 5: the monsoon splits the chain and the west reorgs when it lifts", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/voyages/the-monsoon");
    await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Bring the monsoon" }).click();
    await fast(page);
    await page.getByRole("button", { name: "Esi pays Farah 10 KAUDI" }).click({ timeout: 150_000 });
    await expect(page.getByText(/Kolkata: never heard of it/)).toBeVisible();
    await page.getByRole("button", { name: "Lift the monsoon" }).click({ timeout: 60_000 });
    await expect(page.locator("li[aria-current=step]")).toHaveCount(0, { timeout: 120_000 });
    await expect(page.getByText("(done)")).toHaveCount(5);
  });
  test("voyage 6: the Corsair's double spend succeeds step by step", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/voyages/the-corsair");
    await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Arm the Corsair" }).click();
    await page.getByRole("button", { name: "Make both payments" }).click();
    await fast(page);
    await page.getByRole("button", { name: "Reveal it" }).click({ timeout: 200_000 });
    await expect(page.getByText("(done)")).toHaveCount(5, { timeout: 60_000 });
  });
  test("voyage 6: the whitepaper odds fall as confirmations rise", async ({ page }) => {
    await page.goto("/voyages/the-corsair");
    const rows = page.getByRole("table").last().getByRole("row");
    await expect(rows.nth(1)).toContainText("certain");
    await expect(rows.nth(6)).toContainText("%");
  });
  test("voyage 4: watch a block sail, a tie, and the tie breaking", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/voyages/the-race");
    await expect(page.locator("[data-block]").first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Make it likelier" }).click();
    await fast(page);
    await expect(page.getByText("(done)")).toHaveCount(3, { timeout: 240_000 });
  });
});

test("inspector: opening a block explains its proof of work and closes with Escape", async ({ page }) => {
  await page.goto("/sea");
  await page.locator("[data-block]").last().click({ timeout: 30_000 });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /^Block #\d+/ })).toBeVisible();
  await expect(dialog.getByText("Proof of work")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("rules page is generated from the validator", async ({ page }) => {
  await page.goto("/rules");
  for (const code of ["block-pow", "block-reward", "tx-bad-signature", "tx-conflict", "block-merkle"]) await expect(page.getByText(code, { exact: true })).toBeVisible();
});
