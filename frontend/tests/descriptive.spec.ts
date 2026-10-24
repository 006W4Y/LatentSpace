import { expect, test } from "@playwright/test";

test("ambiguous dates stay selectable and numerical codes get no name-based interpretation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Eigene Daten erkunden" }).click();
  await page.getByLabel("Datendatei auswählen").setInputFiles({
    name: "dates.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Datum,Monat,Wert\n01/02/2026,1,10\n03/04/2026,2,20\n05/06/2026,3,30\n",
    ),
  });
  await expect(
    page.getByRole("button", { name: "Analyse starten", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Datumsformat für Datum", { exact: true })
    .selectOption("mdy");
  await page
    .getByRole("button", { name: "Analyse starten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.locator(".profile-month_codes")).toHaveCount(0);
  await expect(page.locator(".profile-calendar")).toContainText("Jan 26");
  await page
    .getByRole("button", { name: "Analyse einstellen", exact: true })
    .click();
  await expect(
    page.getByLabel("Datumsformat für Datum", { exact: true }),
  ).toHaveValue("mdy");
  await page
    .getByLabel("Rolle für Monat", { exact: true })
    .selectOption("category");
  const row = page
    .getByRole("dialog")
    .locator("tr")
    .filter({ has: page.getByLabel("Rolle für Monat", { exact: true }) });
  await row.getByText("Darstellung wählen", { exact: true }).click();
  await page
    .getByLabel("Monatsdarstellung für Monat", { exact: true })
    .selectOption("one");
  await page
    .getByLabel("Einheitenlabel für Monat", { exact: true })
    .fill("Kalendercode");
  await page
    .getByRole("button", { name: "Analyse starten", exact: true })
    .click();
  await expect(page.locator(".profile-month_codes")).toContainText("Januar", {
    timeout: 30000,
  });
  await expect(page.locator(".profile-month_codes")).toContainText(
    "Kalendercode",
  );
  expect(errors).toEqual([]);
});

test("finding pages expose totals, procedure types and mathematical ordering", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Eigene Daten erkunden" }).click();
  const header = Array.from({ length: 9 }, (_, i) => `M${i}`),
    rows = Array.from({ length: 100 }, (_, i) =>
      header.map((_, j) => (i + 1) * (j + 1)).join(","),
    );
  await page.getByLabel("Datendatei auswählen").setInputFiles({
    name: "many.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([header.join(","), ...rows].join("\n")),
  });
  await page
    .getByRole("button", { name: "Analyse starten", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Insights", exact: true }).click();
  await page
    .getByLabel("Befunde pro Seite", { exact: true })
    .selectOption("10");
  await expect(page.locator(".discovery-card")).toHaveCount(10);
  await expect(page.locator(".finding-controls")).toContainText("73 gefunden");
  await page
    .getByLabel("Befunde sortieren nach", { exact: true })
    .selectOption("strength");
  await page
    .getByLabel("Befund-Sortierrichtung", { exact: true })
    .selectOption("desc");
  await expect(page.locator(".discovery-card").first()).toContainText(
    "Absoluter Pearson r",
  );
  const firstTitle = await page
    .locator(".discovery-card h3")
    .first()
    .innerText();
  await page
    .getByRole("button", { name: "Nächste Befundliste", exact: true })
    .click();
  await expect(page.locator(".finding-controls")).toContainText(
    "Seite 2 von 8",
  );
  await expect(page.locator(".discovery-card h3").first()).not.toHaveText(
    firstTitle,
  );
  await page
    .getByLabel("Ergebnisart filtern", { exact: true })
    .selectOption("model");
  await expect(page.locator(".discovery-card")).toHaveCount(1);
  await expect(page.locator(".discovery-card .origin-badge")).toHaveText(
    "Modellmarkierung",
  );
  await expect(page.locator(".discovery-card")).toContainText(
    "Isolation-Forest-Modellbasis: 100 Gesamtzeilen",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("browser mutations require the local token and the app obtains it automatically", async ({
  page,
}) => {
  await page.goto("/");
  const denied = await page.evaluate(async () => {
    const response = await fetch("/api/datasets/demo", { method: "POST" });
    return { status: response.status, body: await response.json() };
  });
  expect(denied.status).toBe(403);
  expect(denied.body.code).toBe("LOCAL_TOKEN");
  await page.getByRole("button", { name: "Mit Beispieldaten starten" }).click();
  await expect(
    page.getByRole("heading", { name: "Was deine Daten zeigen" }),
  ).toBeVisible({ timeout: 30000 });
});
