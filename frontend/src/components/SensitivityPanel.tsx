import { number } from "../api";
import type { SensitivityReview } from "../api";
export default function SensitivityPanel({
  review,
  busy,
  onExclude,
}: {
  review: SensitivityReview;
  busy: boolean;
  onExclude: (ids: number[]) => void;
}) {
  const column = review.column_comparison,
    pair = review.pair_comparison;
  return (
    <section className="sensitivity-panel" aria-label="Sensitivitätsvergleich">
      <div className="section-heading">
        <div>
          <span className="eyebrow">BESCHREIBENDER AUSLASSVERGLEICH</span>
          <h3>Wie verändert die Auswahl die Kennzahl?</h3>
        </div>
        {review.excluded_rows.length > 0 && (
          <button
            className="button secondary small"
            disabled={busy}
            onClick={() => onExclude([])}
          >
            Auslassauswahl zurücksetzen
          </button>
        )}
      </div>
      <p>
        {review.remaining_rows} von {review.reference_rows} Referenzzeilen im
        Vergleich · {review.excluded_rows.length} manuell ausgelassen. Die
        ursprüngliche Befundreferenz bleibt bestehen. Es werden keine
        Originaldaten entfernt und keine Modelle neu trainiert.
      </p>
      {review.excluded_rows.length > 0 && (
        <p>
          Ausgelassene Datenzeilen:{" "}
          {review.excluded_rows.map((id) => `#${id + 1}`).join(", ")}
        </p>
      )}
      {column && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{review.column}</th>
                <th>Referenz</th>
                <th>Manuelle Vergleichsauswahl</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["observed", "Beobachtete Werte"],
                  ["missing", "Ohne lesbaren Wert"],
                  ["mean", "Mittelwert"],
                  ["median", "Median"],
                  ["q1", "25-%-Quantil"],
                  ["q3", "75-%-Quantil"],
                  ["std", "Standardabweichung (n − 1)"],
                ] as const
              ).map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td>{number(column.before[key], 4)}</td>
                  <td>{number(column.after[key], 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pair && (
        <p>
          <strong>{pair.columns.join(" / ")} · Pearson r: </strong>
          {number(pair.before, 4)} ({pair.before_n} vollständige Paare) →{" "}
          {number(pair.after, 4)} ({pair.after_n} vollständige Paare).
        </p>
      )}
      {review.single_exclusion.map((item, index) => (
        <div className="single-exclusion" key={index}>
          <h4>{item.metric} · jeweils eine Beobachtung auslassen</h4>
          {item.available ? (
            <>
              <p>
                Referenzwert {number(item.full, 5)} · Bereich nach
                Einzel-Auslassung: {number(item.minimum, 5)} bis{" "}
                {number(item.maximum, 5)} · {item.count} Auslassvergleiche
                {item.undefined
                  ? `, davon ${item.undefined} ohne definierte Kennzahl`
                  : ""}
                .
              </p>
              {item.largest_changes.length > 0 ? (
                <div className="exclusion-examples">
                  {item.largest_changes.map((change) => (
                    <button
                      className="button secondary small"
                      key={change.row_id}
                      disabled={busy}
                      onClick={() => onExclude([change.row_id])}
                    >
                      Ohne #{change.row_id + 1}: {number(change.without, 5)} · Δ{" "}
                      {number(change.difference, 5)}
                    </button>
                  ))}
                </div>
              ) : (
                <p>
                  Die Einzel-Auslassvergleiche verändern diese Kennzahl nicht.
                </p>
              )}
            </>
          ) : (
            <p>
              Für diesen Vergleich sind nicht genügend variierende, vollständige
              Werte vorhanden (n = {item.count}).
            </p>
          )}
        </div>
      ))}
      {!column && !pair && (
        <p>
          Wähle eine numerische Vergleichsspalte für Quantile und
          Einzel-Auslassvergleiche.
        </p>
      )}
      <details>
        <summary>Berechnung und Grenzen</summary>
        <p>{review.method}</p>
        <p>
          Die größten beobachteten Änderungen sind nach ihrem absoluten Abstand
          sortiert. Diese Auswahl liefert keine Fehlerwahrscheinlichkeit und
          keine fachliche Bewertung. Mehrfachsuchen und nachträgliche Auswahlen
          können zufällige Muster hervorheben. Die Tabellenkästchen unten
          ermöglichen einen eigenen Vergleich mit bis zu 50 ausgelassenen
          Zeilen.
        </p>
      </details>
    </section>
  );
}
