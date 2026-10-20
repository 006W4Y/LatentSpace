import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("energy sample supports negative measurements, calendar years, filters and evidence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator(".demo-card")).toHaveCount(3);
  await expect(page.locator(".demo-energy")).toContainText(
    "Eine Zeile = ein Gebäude an einem Tag",
  );
  await page
    .getByRole("button", { name: "Energie & Gebäude erkunden", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".metrics-grid .metric").first()).toContainText(
    "540",
  );
  await expect(page.locator(".profile-calendar")).toContainText("Okt 25");
  await expect(page.locator(".profile-calendar")).toContainText("Mär 26");
  const co2 = page.locator(".profile-card").filter({
    has: page.getByRole("heading", { name: "CO2 ppm", exact: true }),
  });
  await expect(co2.locator(".warm-text")).toHaveText("15");
  await page
    .getByRole("button", { name: "Trends & Zeit", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Darstellung", exact: true }),
  ).toHaveValue("mean");
  await page
    .getByRole("combobox", { name: "Messwert", exact: true })
    .selectOption("Außentemperatur_C");
  await expect(page.locator(".recharts-area")).toBeVisible();
  await page
    .getByLabel("Filterspalte", { exact: true })
    .selectOption("Gebäude");
  await page.getByLabel("Filterwert", { exact: true }).selectOption("Labor");
  await expect(page.locator(".filter-count")).toContainText("180 / 540");
  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await page
    .getByRole("button", { name: "Auffälligkeiten", exact: true })
    .click();
  await expect(page.locator(".anomaly-reason-cell").first()).toContainText(
    "Median",
  );
  await page
    .locator(".table-scroll tbody tr")
    .first()
    .getByRole("button")
    .first()
    .click();
  await expect(page.locator(".comparison-card").first()).toContainText(
    "Vergleichsmedian",
  );
  expect(errors).toEqual([]);
});

test("learning sample opens from import dialog without inventing a time axis", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator(".demo-card")).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Eigene Daten erkunden" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".demo-card")).toHaveCount(3);
  await dialog
    .getByRole("button", { name: "Lernen & Kursnutzung erkunden", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".metrics-grid .metric").first()).toContainText(
    "420",
  );
  await expect(page.locator(".profile-calendar")).toHaveCount(0);
  await expect(page.locator(".profile-identifier")).toContainText("420");
  await page
    .getByRole("button", { name: "Trends & Zeit", exact: true })
    .click();
  await expect(
    page.getByText(
      "Ohne zeitliche Angaben lässt sich kein Zeittrend ableiten.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(page.locator(".recharts-area")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Zusammenhänge", exact: true })
    .click();
  await expect(page.locator(".correlation-row").first()).toBeVisible();
  await page.getByRole("button", { name: "Datentabelle", exact: true }).click();
  await expect(page.locator(".data-table tbody")).toContainText("00001");
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(page.locator(".discovery-relation").first()).toBeVisible();
  await expect(page.locator(".discovery-trend")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

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

test("semantic month charts, evidence feed, anomaly explanation and analyst report", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Mit Beispieldaten starten" }).click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".discovery-card").first()).toBeVisible();
  const dateCard = page.locator(".profile-calendar");
  await expect(dateCard).toContainText("Jan 26");
  await expect(dateCard).toContainText("Jun 26");
  await expect(dateCard).toContainText("Zeilen pro Kalendermonat");
  await expect(page.locator(".profile-identifier")).toContainText(
    "verschiedene Kennungen",
  );
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await expect(page.locator(".findings-banner")).toContainText(
    "überprüfbare Erkenntnisse",
  );
  await page
    .locator(".insight-family-filters")
    .getByRole("button", { name: /^Zeit/ })
    .click();
  await expect(page.locator(".discovery-trend")).toHaveCount(1);
  await expect(page.locator(".discovery-trend")).toContainText("April");
  await page
    .locator(".discovery-trend")
    .getByText("Wie wurde das ermittelt?")
    .click();
  await expect(page.locator(".discovery-trend")).toContainText(
    "keine Prognose",
  );
  await page
    .getByRole("button", { name: "Auffälligkeiten", exact: true })
    .click();
  await expect(page.locator(".anomaly-reason-cell").first()).toContainText(
    "Median",
  );
  await page.getByRole("button", { name: "#13", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Warum fällt diese Zeile auf?" }),
  ).toBeVisible();
  await expect(page.locator(".comparison-card").first()).toContainText(
    "Umsatz",
  );
  await expect(page.locator(".comparison-card").first()).toContainText(
    "Vergleichsmedian",
  );
  await expect(page.locator(".comparison-range").first()).toBeVisible();
  await page.getByRole("button", { name: "Detailansicht schließen" }).click();
  await page.locator(".report-menu summary").click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Vollständige Befunde/ }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("latentspace-insights.json");
  const report = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(report.dataset.rows).toBe(720);
  expect(report.insights.length).toBeGreaterThan(5);
  expect(
    report.explained_anomalies[0].explanation.reasons.length,
  ).toBeGreaterThan(0);
  expect(report.dataset.fingerprint_sha256).toHaveLength(64);
  expect(errors).toEqual([]);
});

test("zero-based month codes show month names instead of numeric indices", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Eigene Daten erkunden" }).click();
  await page.getByLabel("Datendatei auswählen").setInputFiles({
    name: "monate.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Monat,Wert\n0,10\n1,20\n2,30\n1,25\n"),
  });
  await page
    .getByRole("button", { name: "Analyse starten", exact: true })
    .click();
  await expect(page.locator(".profile-month_codes")).toContainText("Jan", {
    timeout: 30000,
  });
  await expect(page.locator(".profile-month_codes")).toContainText("Feb");
  await expect(page.locator(".profile-month_codes")).toContainText("Mär");
  await expect(page.locator(".profile-month_codes")).toContainText(
    "0 = Januar",
  );
});
