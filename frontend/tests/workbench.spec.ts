import { test, expect } from "@playwright/test";

test("demo, linked filters, analysis views, inspector and export", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "In deinen Daten steckt mehr." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mit Beispieldaten starten" }).click();
  await expect(
    page.getByRole("heading", { name: "Deine Datenlandschaft" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".metrics-grid .metric").first()).toContainText(
    "720",
  );
  await page
    .getByLabel("Filterspalte", { exact: true })
    .selectOption("Standort");
  await page.getByLabel("Filterwert", { exact: true }).selectOption("Dresden");
  await expect(page.locator(".metrics-grid .metric").first()).not.toContainText(
    "720",
  );
  await page
    .getByRole("button", { name: "Trends & Zeit", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Wie entwickeln sich deine Daten?" }),
  ).toBeVisible();
  await expect(page.locator(".recharts-area")).toBeVisible();
  await page.getByRole("button", { name: "Gruppen", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Automatisch entdeckte Gruppen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await page
    .getByRole("button", { name: "Zusammenhänge", exact: true })
    .click();
  await expect(page.locator(".correlation-row").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Datenlandschaft", exact: true })
    .click();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(page.getByText("Ziehen zum Drehen")).toBeVisible();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.getByRole("button", { name: "Auswählen", exact: true }).click();
  const bounds = await page.locator("canvas").boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + 8, bounds!.y + 8);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + 25, bounds!.y + 25, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByText("Keine Punkte in dieser Auswahl.")).toBeVisible();
  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await page.getByRole("button", { name: "Datentabelle", exact: true }).click();
  await page.getByRole("button", { name: "#1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Zeile #1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nur diese Zeile anzeigen" }).click();
  await expect(page.locator(".data-table tbody tr")).toHaveCount(1);
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Auswahl exportieren", exact: true })
    .click();
  const exported = await downloadEvent;
  expect(exported.suggestedFilename()).toBe("latentspace-auswahl.csv");
  expect(errors).toEqual([]);
});

test("CSV import wizard preserves roles and German decimals", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Eigene Daten erkunden" }).click();
  await page.getByLabel("Dezimaltrennzeichen in Textwerten").selectOption(",");
  await page.getByLabel("Datendatei auswählen").setInputFiles({
    name: "umsatz.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Kunden_ID;Datum;Umsatz;Ort\n001;01.01.2026;1.234,50;Dresden\n002;02.01.2026;250,00;Berlin\n003;03.01.2026;300,00;Dresden\n",
    ),
  });
  await expect(
    page.getByRole("heading", { name: "Einmal prüfen. Dann entdecken." }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Rolle für Kunden_ID", { exact: true }),
  ).toHaveValue("identifier");
  await page
    .getByRole("button", { name: "Analyse starten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Deine Datenlandschaft" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Datentabelle", exact: true }).click();
  await expect(page.locator(".data-table tbody")).toContainText("001");
  await expect(page.locator(".data-table tbody")).toContainText("1.234,50");
  await page
    .getByRole("button", { name: "Trends & Zeit", exact: true })
    .click();
  await expect(page.getByText("Noch keine Datumsspalte erkannt.")).toHaveCount(
    0,
  );
});

test("mobile start page fits and demo is usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Mit Beispieldaten starten" }).click();
  await expect(
    page.getByRole("heading", { name: "Deine Datenlandschaft" }),
  ).toBeVisible({ timeout: 30000 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
