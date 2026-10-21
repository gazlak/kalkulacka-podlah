import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Heslo").fill(password);
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page).toHaveURL(/\/history/);
}

test("podlahář: nová kalkulace → 4 kroky → uložit → PDF → porovnání", async ({ page }) => {
  await login(page, "novak@demo.cz", "heslo1234");
  await expect(page.getByText("Showroom")).toHaveCount(0); // cizí kalkulace nevidí
  await expect(page.getByText("Chata Procházkovi")).toHaveCount(0);

  await page.getByRole("link", { name: "Nová" }).click();
  await expect(page).toHaveURL(/\/wizard\/.+\/1/);

  // krok 1: validace a živá plocha
  await page.getByLabel("Šířka").fill("");
  await page.getByRole("button", { name: "Dál" }).click();
  await expect(page.getByText("Vyplňte číslo 1–500 cm").first()).toBeVisible();
  await page.getByLabel("Šířka").fill("100");
  await page.getByLabel("Hloubka nášlapu").fill("30");
  await page.getByLabel("Výška podstupnice").fill("18");
  await page.getByLabel("Počet schodů").fill("10");
  await expect(page.getByText("4,80 m²").first()).toBeVisible();
  await page.getByRole("button", { name: "Dál" }).click();

  // krok 2: vzor (nelze pokračovat bez výběru)
  await expect(page.getByRole("heading", { name: "Vzor obkladu" })).toBeVisible();
  await page.getByRole("button", { name: "Dál" }).click();
  await expect(page.getByText("Vyberte jeden vzor")).toBeVisible();
  await page.locator(".tile").first().click();
  await expect(page.locator(".actionbar strong")).toContainText("17 887");
  await page.getByRole("button", { name: "Dál" }).click();

  // krok 3 + 4
  await page.getByLabel("Zákazník").fill("Test Zákazník");
  await page.getByRole("button", { name: "Dál" }).click();
  await expect(page.locator(".hero .big")).toContainText("17 887");
  await page.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(page).toHaveURL(/\/calc\/[^/]+$/);
  await expect(page.getByText(/č\. 2026-\d{4}/).first()).toBeVisible();

  // PDF
  await page.getByRole("button", { name: "PDF" }).first().click();
  await expect(page).toHaveURL(/\/pdf$/);
  await expect(page.locator(".pdf-sheet")).toContainText("Test Zákazník");
  await page.getByRole("link", { name: "Zpět" }).last().click();

  // porovnání
  await page.locator("a.pat").click();
  await expect(page.getByRole("heading", { name: "Porovnání vzorů" })).toBeVisible();
  await expect(page.locator(".cmp-row")).toHaveCount(6);
});

test("admin vidí cizí kalkulace jen ke čtení a změna ceníku vyvolá upozornění", async ({ page }) => {
  await login(page, "admin@demo.cz", "admin1234");
  await expect(page.getByText("Chata Procházkovi")).toBeVisible();
  await page.getByText("Chata Procházkovi").click();
  await expect(page.getByText("jen ke čtení")).toBeVisible();
  await expect(page.getByRole("button", { name: "Uložit změny" })).toHaveCount(0);

  // změna ceníku
  await page.getByRole("link", { name: "Zpět" }).first().click();
  await page.getByRole("link", { name: "Správa" }).click();
  await page.getByRole("tab", { name: "Sazby" }).click();
  await page.locator('input[name="transport"]').fill("2000");
  await page.getByRole("button", { name: "Uložit sazby" }).click();
  await expect(page.getByText("Sazby uloženy")).toBeVisible();

  await page.getByRole("link", { name: "Kalkulace" }).click();
  await page.getByText("Showroom").click();
  await expect(page.getByText("Ceník se od uložení kalkulace změnil")).toBeVisible();
});

test("podlahář nemá přístup do správy", async ({ page }) => {
  await login(page, "novak@demo.cz", "heslo1234");
  await expect(page.getByRole("link", { name: "Správa" })).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/history/);
});

test("blokace po 5 chybných pokusech", async ({ page }) => {
  await page.goto("/login");
  for (let i = 0; i < 5; i++) {
    await page.getByLabel("E-mail").fill("svoboda@demo.cz");
    await page.getByLabel("Heslo").fill("špatně");
    await page.getByRole("button", { name: "Přihlásit se" }).click();
  }
  await expect(page.getByText(/zablokované ještě/)).toBeVisible();
});
