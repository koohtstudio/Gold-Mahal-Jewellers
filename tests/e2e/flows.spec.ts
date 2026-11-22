import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { login, reserve } from "./helpers";

test.describe("storefront", () => {
  test("ticker, calculator and trade-in estimator work", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Trust");
    await expect(page.getByRole("group", { name: /gold rate per gram/i })).toContainText("$208.00");
    const calc = page.locator("#rate");
    await calc.getByRole("button", { name: "More weight" }).click();
    await expect(calc.getByText("5.5 g")).toBeVisible();
    await calc.getByRole("button", { name: "24k" }).click();
    await expect(calc.getByText("Gold value")).toBeVisible();
    const trade = page.locator("#tradein");
    await expect(trade.getByText("Trade-in estimate")).toBeVisible();
    await expect(trade.getByText("$1,792.33")).toBeVisible();
  });

  test("reserve happy path gives a code and clears the bag", async ({ page }) => {
    const code = await reserve(page, "Large Light-Weight Tops");
    expect(code).toMatch(/^GM-\d{4}$/);
    await expect(page.getByText(/Thanks Test/)).toBeVisible();
    await page.getByRole("button", { name: "Back to the shop" }).click();
    await expect(page.getByRole("button", { name: /0 items in the bag/ })).toBeVisible();
  });

  test("a reserved piece cannot be reserved again", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("link", { name: /^22k Gold Jhumka/ }).click();
    const dialog = page.getByRole("dialog", { name: /details/ });
    await expect(dialog.getByText(/reserved for another customer/i)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Reserve this piece" })).toHaveCount(0);
  });

  test("validation: phone must be 10 digits and honeypot stores nothing", async ({ page }) => {
    await page.goto("/shop");
    await page.getByRole("link", { name: /^Large Light-Weight Tops/ }).click();
    await page.getByRole("dialog", { name: /details/ }).getByRole("button", { name: "Reserve this piece" }).click();
    const drawer = page.getByRole("dialog", { name: "Reserve bag" });
    await drawer.getByRole("button", { name: "Choose a visit time" }).click();
    await drawer.getByLabel("Name").fill("Bad Phone");
    await drawer.getByLabel("Mobile").fill("12345");
    await drawer.locator('[aria-label="Visit time"] button:not([disabled])').first().click();
    await page.waitForTimeout(1700);
    await drawer.getByRole("button", { name: "Reserve my pieces" }).click();
    await expect(drawer.getByText("Please enter a 10 digit mobile number.")).toBeVisible();
  });

  test("a visit request is saved for the admin and shown on the dashboard", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Book a visit" }).first().click();
    const d = page.getByRole("dialog", { name: "Book a visit" });
    await d.getByRole("button", { name: "Repairs and resizing" }).click();
    await d.getByLabel("Name").fill("Visit Person");
    await d.getByLabel("Mobile").fill("905 555 0188");
    await page.waitForTimeout(1700);
    await d.getByRole("button", { name: "Send request" }).click();
    await expect(d.getByText("Request sent.")).toBeVisible();
    await login(page, "owner");
    await page.goto("/admin/reservations?tab=visits");
    await expect(page.getByRole("cell", { name: "Visit Person" })).toBeVisible();
  });
});

test.describe("two tabs", () => {
  test("a reservation reaches admin, Ready reaches the customer, inventory shows Reserved", async ({ context }) => {
    const shop = await context.newPage();
    const admin = await context.newPage();
    await login(admin, "owner");
    await admin.goto("/admin/reservations");
    await expect(admin.getByRole("list", { name: "Reservations" })).toBeVisible();

    const code = await reserve(shop, "Pendant and Earring Set", { name: "Cross Tab" });
    await expect(admin.getByText(code).first()).toBeVisible({ timeout: 5000 });
    await expect(admin.getByRole("button", { name: /Cross Tab/ })).toBeVisible();

    await admin.getByRole("button", { name: "Ready, text customer" }).click();
    await expect(shop.getByText("Ready for pickup.")).toBeVisible({ timeout: 5000 });

    await admin.goto("/admin/inventory");
    const row = admin.getByRole("row", { name: /Pendant and Earring Set/ });
    await expect(row.getByText("Reserved")).toBeVisible();

    await admin.goto("/admin/reservations");
    await admin.getByRole("button", { name: "Mark sold" }).click();
    await expect(admin.getByText(/marked sold and added to the sales ledger/)).toBeVisible();
  });

  test("publishing a rate moves the prices on the shop", async ({ context }) => {
    const shop = await context.newPage();
    await shop.goto("/shop");
    await expect(shop.getByText("$208.00/g").first()).toBeVisible();
    const admin = await context.newPage();
    await login(admin, "owner");
    await admin.goto("/admin/rate");
    for (let i = 0; i < 2; i++) await admin.getByRole("button", { name: "Raise rate by one dollar" }).click();
    await expect(admin.getByText("$192.50").first()).toBeVisible();
    await admin.getByRole("button", { name: "Publish to website" }).click();
    await expect(admin.getByText(/New rate published/)).toBeVisible();
    await expect(shop.getByText("$210.00/g").first()).toBeVisible({ timeout: 5000 });
    await expect(shop.getByText("$192.50/g").first()).toBeVisible();
  });
});

test.describe("admin", () => {
  test("old gold payout is blocked without the ID check", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/admin/old-gold");
    await page.getByLabel("Weight (g)").fill("10");
    const record = page.getByRole("button", { name: "Record purchase" });
    await expect(record).toBeDisabled();
    await expect(page.getByText("Turn on Photo ID checked to enable the payout.")).toBeVisible();
    await page.getByRole("switch", { name: "Photo ID checked and copied" }).click();
    await page.getByLabel("ID reference", { exact: true }).fill("Driver licence ending 4821");
    await expect(page.getByText(/Pays/).first()).toContainText("$1,792.33");
    await expect(record).toBeEnabled();
    await record.click();
    await expect(page.getByText(/Recorded. Pay \$1,792.33/)).toBeVisible();
  });

  test("a layaway payment reaches the books", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/admin/books");
    const rows = () => page.getByRole("region", { name: "Sales ledger" }).locator("tbody tr").count();
    await expect(page.getByRole("region", { name: "Sales ledger" })).toBeVisible();
    const before = await rows();
    await page.goto("/admin/layaway");
    await page.getByRole("button", { name: /Record .* for Harpreet S\./ }).click();
    await expect(page.getByText(/added to the books/)).toBeVisible();
    await page.goto("/admin/books");
    await expect(page.getByRole("region", { name: "Sales ledger" })).toBeVisible();
    await expect.poll(rows).toBe(before + 1);
  });

  test("books download real CSV files and send history grows", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/admin/books");
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Sales ledger \(CSV\)/ }).click()]);
    expect(dl.suggestedFilename()).toMatch(/^sales-.*\.csv$/);
    const text = readFileSync((await dl.path()) as string);
    expect(text[0]).toBe(0xef);
    expect(text[1]).toBe(0xbb);
    expect(text[2]).toBe(0xbf);
    expect(text.toString("utf8")).toContain("Date,Ref,Customer,Type,Subtotal,HST 13%,Total");
    const [zip] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Full accountant pack/ }).click()]);
    expect(zip.suggestedFilename()).toMatch(/^accountant-pack-.*\.zip$/);

    const hist = page.getByRole("list", { name: "Send history" }).locator("li");
    const n = await hist.count();
    await page.getByRole("button", { name: /^Send .* books to Sam$/ }).click();
    await expect(page.getByText(/preview, nothing was sent/)).toBeVisible();
    await expect(hist).toHaveCount(Math.min(6, n + 1));
    await expect(hist.first()).toContainText("Sent today");
  });

  test("staff cannot see books or settings, signed out visitors go to login", async ({ page, context }) => {
    await page.goto("/admin/books");
    await expect(page).toHaveURL(/\/admin\/login/);
    await login(page, "staff");
    await expect(page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name: "Books" })).toHaveCount(0);
    await page.goto("/admin/books");
    await expect(page.getByText("Owner only")).toBeVisible();
    await page.goto("/admin/settings");
    await expect(page.getByText("Owner only")).toBeVisible();
    await page.goto("/admin/rate");
    await expect(page.getByRole("button", { name: "Publish to website" })).toBeDisabled();
    await context.clearCookies();
  });

  test("reset demo data puts the sample rate back", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/admin/rate");
    await page.getByRole("button", { name: "Raise rate by one dollar" }).click();
    await page.getByRole("button", { name: "Publish to website" }).click();
    await expect(page.getByText(/New rate published/)).toBeVisible();
    await expect(page.getByRole("link", { name: /22k today/ })).toContainText("$191.58");
    await page.getByRole("button", { name: "Reset demo data" }).first().click();
    await page.getByRole("button", { name: "Yes, reset" }).click();
    await expect(page.getByRole("link", { name: /22k today/ })).toContainText("$190.67");
  });

  test("corrupt storage is replaced with the sample data, never a crash", async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("seeded-bad")) {
        localStorage.setItem("gm-mock-v1", "{not json");
        sessionStorage.setItem("seeded-bad", "1");
      }
    });
    await page.goto("/shop");
    await expect(page.getByRole("link", { name: /^22k Gold Balis/ })).toBeVisible();
    await login(page, "owner");
    await expect(page.getByText("Needs you today")).toBeVisible();
  });

  test("jobs move from intake to ready", async ({ page }) => {
    await login(page, "owner");
    await page.goto("/admin/jobs");
    await page.getByRole("button", { name: "Start work" }).first().click();
    await expect(page.getByText(/sent to the workshop/)).toBeVisible();
  });
});
