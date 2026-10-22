import type { Exploration } from "../api";
export default function DiagnosticControls({
  coverage,
  columns,
  keys,
  onKeys,
}: {
  coverage: Exploration["coverage"];
  columns: string[];
  keys: string[];
  onKeys: (keys: string[]) => void;
}) {
  return (
    <section className="diagnostic-controls">
      <details>
        <summary>Analyseabdeckung & Duplikatschlüssel</summary>
        <p>
          <strong>
            {coverage.columns_checked} Spalten auf Eignung geprüft
          </strong>{" "}
          · {coverage.numeric_columns} Messwerte, {coverage.category_columns}{" "}
          Kategorien, {coverage.date_columns} Datumsmerkmale.{" "}
          {coverage.candidates} Kandidaten vor Priorisierung.
        </p>
        <p>{coverage.note}</p>
        <p>
          Geprüfte Kombinationen: {coverage.numeric_pairs_tested} Messwertpaare
          · {coverage.group_measure_pairs} Kategorie/Messwert ·{" "}
          {coverage.date_measure_pairs} Zeit/Messwert.
        </p>
        {coverage.duplicate_check.keys.length > 0 && (
          <p>
            Schlüsselprüfung: {coverage.duplicate_check.complete} vollständige
            Schlüssel, {coverage.duplicate_check.duplicate_rows} Zeilen mit
            mehrfach vorkommendem Schlüssel, {coverage.duplicate_check.skipped}{" "}
            unvollständige ausgelassen.
          </p>
        )}
        <fieldset>
          <legend>
            Schlüssel für die Duplikatprüfung (bis zu acht Spalten)
          </legend>
          <p>
            Wähle, welche Kombination eine Zeile fachlich eindeutig
            identifizieren sollte. Unvollständige Schlüssel werden ausgelassen.
          </p>
          <div className="key-options">
            {columns.map((column) => (
              <label key={column}>
                <input
                  type="checkbox"
                  aria-label={`Duplikatschlüssel ${column}`}
                  checked={keys.includes(column)}
                  disabled={!keys.includes(column) && keys.length >= 8}
                  onChange={(event) =>
                    onKeys(
                      event.target.checked
                        ? [...keys, column]
                        : keys.filter((key) => key !== column),
                    )
                  }
                />
                {column}
              </label>
            ))}
          </div>
        </fieldset>
      </details>
    </section>
  );
}
