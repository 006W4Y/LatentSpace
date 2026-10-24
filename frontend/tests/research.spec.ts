import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("finding reference, cells, notes and analysis configuration survive changed filters and browser reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const rows = [
    ...Array.from({ length: 80 }, (_, i) => `${10 + i / 80},A`),
    "20,A",
    "21,A",
    "22,A",
    ...Array.from({ length: 80 }, (_, i) => `${1000 + i * 2},B`),
  ];
  await page.goto("/");
  await page.getByRole("button", { name: "Eigene Daten erkunden" }).click();
  await page.getByLabel("Datendatei auswählen").setInputFiles({
    name: "referenz.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Messwert,Gruppe\n" + rows.join("\n")),
  });
  await page
    .getByRole("button", { name: "Analyse starten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByLabel("Filterspalte", { exact: true }).selectOption("Gruppe");
  await page.getByLabel("Filterwert", { exact: true }).selectOption("A");
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  const finding = page.locator(".discovery-card").filter({
    has: page.getByRole("heading", {
      name: "Messwert: 3 Werte außerhalb des Vergleichsbereichs",
      exact: true,
    }),
  });
  await finding.getByRole("button", { name: "Befund untersuchen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".reference-banner")).toContainText(
    "83 Zeilen beim Finden",
  );
  await expect(dialog.locator(".investigation-table tbody tr")).toHaveCount(3);
  await expect(dialog.locator(".finding-cell-iqr")).toHaveCount(3);
  await expect(dialog.locator(".finding-rules")).toContainText(
    "Quartilsabstand",
  );
  await dialog
    .getByRole("button", { name: "Übrige Zeilen", exact: true })
    .click();
  await expect(dialog.locator(".pagination")).toContainText("80 Zeilen");
  await expect(dialog.locator(".finding-cell")).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Befundzeilen", exact: true })
    .click();
  await expect(dialog.locator(".finding-cell-iqr")).toHaveCount(3);
  await dialog
    .getByLabel("Zeile 81 im Vergleich auslassen", { exact: true })
    .check();
  await expect(dialog.getByLabel("Sensitivitätsvergleich")).toContainText(
    "82 von 83 Referenzzeilen",
  );
  await dialog
    .getByLabel("Befundname", { exact: true })
    .fill("Werte in Gruppe A prüfen");
  await dialog
    .getByLabel("Notizen zum Befund")
    .fill("Mit Fachbereich abgleichen.");
  await dialog
    .getByRole("button", { name: "Befund dauerhaft speichern" })
    .click();
  await expect(dialog.locator(".saved-indicator")).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await dialog
    .getByRole("button", { name: "Befund als JSON exportieren" })
    .click();
  const file = await downloaded;
  const report = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(report.reference_row_ids).toHaveLength(83);
  expect(report.rows).toHaveLength(3);
  expect(report.notes).toBe("Mit Fachbereich abgleichen.");
  expect(report.notes_origin).toBe("user");
  expect(report.review.excluded_rows).toEqual([80]);
  expect(report.finding.basis.filters).toEqual(["Gruppe = A"]);
  expect(report.finding.basis.reference_rows).toBe(83);
  await dialog
    .getByRole("button", { name: "Befunduntersuchung schließen" })
    .click();
  await expect(page.locator(".research-shelf")).toContainText(
    "Werte in Gruppe A prüfen",
  );
  page.once("dialog", (dialog) => dialog.accept("Gruppe A · Analysestand"));
  await page
    .getByRole("button", { name: "Ansicht merken", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Gruppe A · Analysestand", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Filterwert", { exact: true }).selectOption("B");
  await page
    .locator(".research-shelf")
    .getByRole("button", { name: "Werte in Gruppe A prüfen", exact: true })
    .click();
  await expect(dialog.locator(".reference-banner")).toContainText(
    "83 Zeilen beim Finden",
  );
  await expect(dialog.locator(".finding-cell-iqr")).toHaveCount(3);
  await expect(
    dialog.getByLabel("Zeile 81 im Vergleich auslassen", { exact: true }),
  ).toBeChecked();
  await expect(dialog.getByLabel("Notizen zum Befund")).toHaveValue(
    "Mit Fachbereich abgleichen.",
  );
  await expect(dialog.getByLabel("Befundname", { exact: true })).toHaveValue(
    "Werte in Gruppe A prüfen",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await dialog
    .getByRole("button", { name: "Befunduntersuchung schließen" })
    .click();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page
    .getByRole("button", { name: "referenz.csv 163 Zeilen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Gruppe A · Analysestand", exact: true })
    .click();
  await expect(page.getByLabel("Filterwert", { exact: true })).toHaveValue(
    "A",
    { timeout: 30000 },
  );
  await expect(page.locator(".research-shelf")).toContainText(
    "Mit Fachbereich abgleichen.",
  );
  await page
    .locator(".research-shelf")
    .getByRole("button", { name: "Werte in Gruppe A prüfen", exact: true })
    .click();
  await expect(dialog.locator(".reference-banner")).toContainText(
    "83 Zeilen beim Finden",
  );
  expect(errors).toEqual([]);
});

test("chosen duplicate keys produce direct cell evidence for preserved source IDs", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Eigene Daten erkunden" }).click();
  await page.getByLabel("Datendatei auswählen").setInputFiles({
    name: "schluessel.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Kunden_ID,Wert\n001,5\n001,6\n002,7\n,8\n"),
  });
  await page
    .getByRole("button", { name: "Analyse starten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page
    .getByText("Analyseabdeckung & Duplikatschlüssel", { exact: true })
    .click();
  await page.getByLabel("Duplikatschlüssel Kunden_ID", { exact: true }).check();
  const finding = page.locator(".discovery-card").filter({
    has: page.getByRole("heading", {
      name: "2 Zeilen teilen denselben gewählten Schlüssel",
      exact: true,
    }),
  });
  await finding.getByRole("button", { name: "Befund untersuchen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".finding-cell-duplicate")).toHaveCount(2);
  await expect(dialog.locator(".finding-cell-duplicate").first()).toContainText(
    "001",
  );
  await expect(dialog.locator(".finding-rules")).toContainText("Schlüssel");
});

test("a real Iris CSV keeps its measurements and categorical group comparisons", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Eigene Daten erkunden" }).click();
  await page
    .getByLabel("Datendatei auswählen")
    .setInputFiles("../backend/tests/fixtures/iris.csv");
  await page
    .getByRole("button", { name: "Analyse starten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  const finding = page
    .locator(".discovery-card")
    .filter({
      has: page.getByRole("heading", {
        name: /unterscheidet sich nach Species/,
      }),
    })
    .first();
  await finding.getByRole("button", { name: "Befund untersuchen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".reference-banner")).toContainText(
    "150 Zeilen beim Finden",
  );
  await expect(dialog.locator(".investigation-cohorts tbody tr")).toHaveCount(
    3,
  );
  await expect(dialog.locator(".investigation-cohorts")).toContainText(
    "setosa",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});
