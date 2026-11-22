import { expect, test } from "@playwright/test";

const ROOM = `e2e-${process.env.DEMO_ROOM_SUFFIX ?? "sync"}`;

/** Two separate browsers (no shared storage), like the owner's phone and laptop. They only share the Neon room. */
test("a reservation made on a phone reaches the admin on a laptop, and Ready and a new rate come back", async ({ browser }) => {
  const laptop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const admin = await laptop.newPage();
  const shop = await phone.newPage();

  // Laptop: sign in and start from clean sample data.
  await admin.goto(`/admin/login?room=${ROOM}`);
  await admin.getByRole("button", { name: /Continue as the owner/ }).click();
  await admin.waitForURL(/\/admin$/);
  await admin.getByRole("button", { name: "Reset demo data" }).first().click();
  await admin.getByRole("button", { name: "Yes, reset" }).click();
  await expect(admin.getByText(/Demo data reset/)).toBeVisible();
  await admin.goto("/admin/reservations");

  // Phone: reserve earrings.
  await shop.goto(`/shop?room=${ROOM}`);
  await shop.getByRole("link", { name: /Large Light-Weight Tops/ }).first().click();
  await shop.getByRole("dialog", { name: /details/ }).getByRole("button", { name: "Reserve this piece" }).click();
  const drawer = shop.getByRole("dialog", { name: "Reserve bag" });
  await drawer.getByRole("button", { name: "Choose a visit time" }).click();
  await drawer.locator('[aria-label="Visit time"] button:not([disabled])').first().click();
  await drawer.getByLabel("Name").fill("Phone Owner");
  await drawer.getByLabel("Mobile").fill("416 555 0123");
  await shop.waitForTimeout(1700);
  await drawer.getByRole("button", { name: "Reserve my pieces" }).click();
  const code = (await drawer.getByText(/^GM-\d{4}$/).textContent()) as string;

  // Laptop: it appears within a few seconds, no refresh.
  await expect(admin.getByRole("button", { name: /Phone Owner/ })).toBeVisible({ timeout: 12_000 });
  await admin.getByRole("button", { name: /Phone Owner/ }).click();
  await expect(admin.getByText(code).first()).toBeVisible();
  await admin.getByRole("button", { name: "Ready, text customer" }).click();

  // Phone: the confirmation turns to Ready.
  await expect(shop.getByText("Ready for pickup.")).toBeVisible({ timeout: 12_000 });

  // Laptop publishes a new rate, phone prices move.
  await admin.goto("/admin/rate");
  await admin.getByRole("button", { name: "Raise rate by one dollar" }).click();
  await admin.getByRole("button", { name: "Publish to website" }).click();
  await expect(admin.getByText(/New rate published/)).toBeVisible();
  await shop.getByRole("button", { name: "Close" }).click();
  await expect(shop.getByText("$209.00/g").first()).toBeVisible({ timeout: 12_000 });

  // Leave the room clean.
  await admin.getByRole("button", { name: "Reset demo data" }).first().click();
  await admin.getByRole("button", { name: "Yes, reset" }).click();
  await laptop.close();
  await phone.close();
});
