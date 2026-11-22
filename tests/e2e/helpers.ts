import { expect, type Page } from "@playwright/test";

export async function login(page: Page, role: "owner" | "staff" = "owner") {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: role === "owner" ? /Continue as the owner/ : /Continue as counter staff/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForURL(/\/admin(\?.*)?$/);
}

/** Reserve a piece from the shop page and return the code. Waits past the 1.5 second human check. */
export async function reserve(page: Page, pieceName: string, opts: { name?: string; phone?: string } = {}) {
  await page.goto("/shop");
  await page.getByRole("link", { name: new RegExp(`^${pieceName}`) }).first().click();
  const dialog = page.getByRole("dialog", { name: /details/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Reserve this piece" }).click();
  const drawer = page.getByRole("dialog", { name: "Reserve bag" });
  await drawer.getByRole("button", { name: "Choose a visit time" }).click();
  await drawer.locator('[aria-label="Visit time"] button:not([disabled])').first().click();
  await drawer.getByLabel("Name").fill(opts.name ?? "Test Customer");
  await drawer.getByLabel("Mobile").fill(opts.phone ?? "416 555 0100");
  await page.waitForTimeout(1700);
  await drawer.getByRole("button", { name: "Reserve my pieces" }).click();
  const code = drawer.getByText(/^GM-\d{4}$/);
  await expect(code).toBeVisible();
  return (await code.textContent()) as string;
}
