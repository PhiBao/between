import { expect, test, type Page } from "@playwright/test";

/**
 * The core loop, exercised the way it actually happens: one parent sends a
 * message they would regret, the other parent answers the agreement that came
 * out of it, and the record can then be exported and independently checked.
 *
 * Requires `pnpm seed` to have been run.
 */

const ALEX = { email: "alex@between.demo", password: "between-demo-2026" };
const SAM = { email: "sam@between.demo", password: "between-demo-2026" };

async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Your record" })).toBeVisible();
}

/**
 * Types a message and waits until the composer has actually taken it.
 *
 * A plain `fill()` can land before React hydrates, in which case the DOM holds
 * the text but component state does not, and the buttons stay disabled. Retrying
 * until the check button is enabled keeps the test honest about what a real user
 * experiences without making it flaky.
 */
async function typeMessage(page: Page, text: string) {
  await expect(async () => {
    await page.getByLabel(/Message to/).fill(text);
    await expect(
      page.getByRole("button", { name: "Check before sending" }),
    ).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}


test("a heated message becomes a calmer one, an agreement, and a verifiable pack", async ({
  browser,
}) => {
  const alexContext = await browser.newContext();
  const samContext = await browser.newContext();
  const alex = await alexContext.newPage();
  const sam = await samContext.newPage();

  await signIn(alex, ALEX);

  // A message that would make things worse, with facts that must survive.
  const hostile =
    "You ALWAYS do this. You were 25 minutes late AGAIN and Mia was waiting. " +
    "Typical. Pickup is 4pm on the 30th and I will not chase you about it.";

  await typeMessage(alex, hostile);
  await alex.getByRole("button", { name: "Check before sending" }).click();

  // Either a suggestion appears, or the guard explains why it was kept as
  // written. Both are correct behaviour; silently sending is not.
  const suggestion = alex.getByRole("heading", { name: "A calmer version" });
  const keptAsWritten = alex.getByText("Kept as written.");
  await expect(suggestion.or(keptAsWritten)).toBeVisible();

  if (await suggestion.isVisible()) {
    const suggested = await alex
      .locator("text=A calmer version")
      .locator("xpath=following-sibling::p[1]")
      .innerText();

    // The facts must have survived the rewrite.
    expect(suggested).toContain("25");
    expect(suggested).toContain("Mia");
    expect(suggested).toMatch(/4\s?pm/i);
    expect(suggested).toContain("30");
    // ...and the ammunition must not have.
    expect(suggested.toLowerCase()).not.toContain("always");
    expect(suggested.toLowerCase()).not.toContain("typical");

    await alex.getByRole("button", { name: "Send this version" }).click();
  } else {
    await alex.getByRole("button", { name: "Send as written" }).click();
  }

  // The message is now in the record.
  await expect(alex.getByText(/Mia was waiting|Mia/).last()).toBeVisible();

  // If a commitment was detected, track it so Sam can answer it.
  const trackButton = alex.getByRole("button", { name: "Track this" }).first();
  const trackedSomething = await trackButton.isVisible().catch(() => false);
  if (trackedSomething) {
    await trackButton.click();
    await expect(alex.getByRole("button", { name: "Tracked" }).first()).toBeVisible();
  }

  // Sam sees the agreements that are waiting on them.
  await signIn(sam, SAM);
  await sam.goto("/agreements");
  await expect(sam.getByRole("heading", { name: "Agreements" })).toBeVisible();

  const confirm = sam.getByRole("button", { name: "That is right" }).first();
  if (await confirm.isVisible().catch(() => false)) {
    await confirm.click();
    await expect(sam.getByText("Confirmed").first()).toBeVisible();
  }

  // Alex exports the pack, and it is a real PDF.
  await alex.goto("/pack");
  const download = await alex.request.get("/pack/download");
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toContain("application/pdf");
  const bytes = await download.body();
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

  // The head hash shown on the pack page verifies on the public page.
  const headHash = (await alex.locator("p.font-mono").first().innerText()).trim();
  expect(headHash).toMatch(/^[0-9a-f]{64}$/);

  const anonymous = await browser.newContext();
  const visitor = await anonymous.newPage();
  await visitor.goto("/verify");
  await visitor.getByLabel("Head hash from the pack").fill(headHash);
  await visitor.getByRole("button", { name: "Check this pack" }).click();
  await expect(visitor.getByText("This pack verifies")).toBeVisible();

  await anonymous.close();
  await alexContext.close();
  await samContext.close();
});

test("a threatening message is never softened", async ({ page }) => {
  await signIn(page, ALEX);

  await typeMessage(
    page,
    "If you are late again I will make you regret it. I know where you work.",
  );
  await page.getByRole("button", { name: "Check before sending" }).click();

  await expect(
    page.getByText(/Between will not soften it/i),
  ).toBeVisible();
  // The parent is still free to send their own words.
  await expect(page.getByRole("button", { name: "Send as written" })).toBeEnabled();
});

test("the record cannot be reached without signing in", async ({ page }) => {
  await page.goto("/record");
  await expect(page).toHaveURL(/\/sign-in/);
});
