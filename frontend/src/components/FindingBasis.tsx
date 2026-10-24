import type { Insight } from "../api";
import { number, roleLabels } from "../api";
export const originLabels = {
  observation: "Beobachtung",
  rule: "Suchregel",
  model: "Modellmarkierung",
};
export default function FindingBasis({
  finding,
  compact = false,
}: {
  finding: Insight;
  compact?: boolean;
}) {
  const basis = finding.basis;
  return (
    <section
      className={`finding-basis ${compact ? "compact" : "reference-banner"}`}
      aria-label="Vergleichsgrundlage"
    >
      <div className="finding-origin">
        <span className={`origin-badge origin-${finding.result_type}`}>
          {originLabels[finding.result_type]}
        </span>
        <span>{finding.procedure}</span>
      </div>
      <strong>
        Referenz: {number(basis.reference_rows, 0)} Zeilen beim Finden
      </strong>
      <p>
        {basis.reference_rows} von {basis.dataset_rows} Gesamtzeilen ·{" "}
        {basis.complete_rows} vollständig in den genannten Spalten ·{" "}
        {basis.missing_cells} Zellen ohne lesbaren Wert
      </p>
      <p>
        <b>Spalten: </b>
        {basis.columns.map((column) => column.name).join(", ") ||
          "Keine numerischen Modellmerkmale"}
      </p>
      <p>
        <b>Filter: </b>
        {basis.filters.join(" · ")}
      </p>
      {basis.model_training_rows != null && (
        <p>
          Isolation-Forest-Modellbasis: {basis.model_training_rows}{" "}
          Gesamtzeilen. Die Anzeige verwendet die oben genannte Referenzauswahl.
        </p>
      )}
      <details>
        <summary>Spaltenbasis und Interpretation</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Spalte</th>
                <th>Rolle</th>
                <th>Beobachtet</th>
                <th>Original leer</th>
                <th>Mit gewählter Rolle unlesbar</th>
                <th>Darstellung (Nutzerauswahl)</th>
              </tr>
            </thead>
            <tbody>
              {basis.columns.map((column) => (
                <tr key={column.name}>
                  <td>{column.name}</td>
                  <td>{roleLabels[column.role]}</td>
                  <td>{column.observed}</td>
                  <td>{column.source_missing}</td>
                  <td>{column.conversion_missing}</td>
                  <td>
                    {[
                      column.display.date_format
                        ? `Datum: ${column.display.date_format}`
                        : "",
                      column.display.month_base &&
                      column.display.month_base !== "none"
                        ? `Monatsnamen: ${column.display.month_base === "zero" ? "0" : "1"} = Januar`
                        : "",
                      column.display.unit_label
                        ? `Label: ${column.display.unit_label}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Originaldarstellung"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
