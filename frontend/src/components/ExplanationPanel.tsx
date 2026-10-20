import { useEffect, useState } from "react";
import { ArrowDownToLine, CircleHelp, LoaderCircle } from "lucide-react";
import type { Comparison, DataRow, RowExplanation } from "../api";
import { api, download, number } from "../api";

function ComparisonCard({ item }: { item: Comparison }) {
  const minimum = Math.min(item.min, item.value),
    maximum = Math.max(item.max, item.value);
  const position = (value: number) =>
    maximum === minimum
      ? 50
      : 5 + ((value - minimum) / (maximum - minimum)) * 90;
  return (
    <article className="comparison-card">
      <div className="comparison-heading">
        <strong>{item.feature.replaceAll("_", " ")}</strong>
        <span>
          {item.kind === "context" ? "Ähnliche Zeilen" : "Gesamtdaten"}
        </span>
      </div>
      <div className="comparison-values">
        <div>
          <span>Diese Zeile</span>
          <strong>{number(item.value, 2)}</strong>
        </div>
        <div>
          <span>Vergleichsmedian</span>
          <strong>{number(item.median, 2)}</strong>
        </div>
      </div>
      <div
        className="comparison-range"
        aria-label={`Wert ${number(item.value, 2)}, Vergleichsmedian ${number(item.median, 2)}, mittlere 50 Prozent ${number(item.q1, 2)} bis ${number(item.q3, 2)}`}
      >
        <div className="range-line" />
        <div
          className="range-iqr"
          style={{
            left: `${position(item.q1)}%`,
            width: `${Math.max(1, position(item.q3) - position(item.q1))}%`,
          }}
        />
        <i
          className="range-median"
          style={{ left: `${position(item.median)}%` }}
        />
        <i
          className="range-value"
          style={{ left: `${position(item.value)}%` }}
        />
      </div>
      <div className="range-labels">
        <span>{number(minimum, 2)}</span>
        <span>{number(maximum, 2)}</span>
      </div>
      <p>{item.detail}</p>
      <small>
        {number(item.reference_n, 0)} andere beobachtete Werte
        {item.kind === "context"
          ? ` · ähnlich in ${item.other_features.join(", ")}`
          : " · gesamter Datensatz"}
      </small>
    </article>
  );
}

export default function ExplanationPanel({
  job,
  row,
}: {
  job: string;
  row: DataRow;
}) {
  const [explanation, setExplanation] = useState<RowExplanation | null>(
    row.explanation ?? null,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setExplanation(row.explanation ?? null);
    setError("");
    if (!row.explanation)
      api<RowExplanation>(`/analyses/${job}/rows/${row.id}/explanation`, {
        signal: controller.signal,
      })
        .then(setExplanation)
        .catch((error) => {
          if (error.name !== "AbortError") setError(error.message);
        });
    return () => controller.abort();
  }, [job, row]);
  if (error)
    return (
      <p role="alert" className="error-inline">
        {error}
      </p>
    );
  if (!explanation)
    return (
      <div className="explanation-loading" role="status">
        <LoaderCircle size={17} className="spin" />
        Vergleichswerte werden ermittelt …
      </div>
    );
  return (
    <section className="explanation-panel">
      <span className="eyebrow">STATISTISCHE EINORDNUNG</span>
      <h3>
        {row.anomaly
          ? "Warum fällt diese Zeile auf?"
          : "Wie liegen die Messwerte?"}
      </h3>
      <p className="explanation-summary">{explanation.summary}</p>
      {explanation.score_percentile !== null && (
        <div className="score-percentile">
          <span>Score-Perzentil im Gesamtdatensatz</span>
          <strong>{number(explanation.score_percentile, 1)}</strong>
        </div>
      )}
      {explanation.reasons.map((item) => (
        <ComparisonCard key={item.feature} item={item} />
      ))}
      {explanation.missing_features.length > 0 && (
        <p className="missing-explanation">
          Keine Messwerterklärung für {explanation.missing_features.join(", ")}:
          Der ursprüngliche Wert fehlt.
        </p>
      )}
      {!explanation.reasons.length && explanation.comparisons.length > 0 && (
        <details className="comparison-details">
          <summary>Messwerte mit dem Datensatz vergleichen</summary>
          {explanation.comparisons.map((item) => (
            <ComparisonCard key={item.feature} item={item} />
          ))}
        </details>
      )}
      <details className="explanation-method">
        <summary>
          <CircleHelp size={13} />
          Vergleichsbasis & Einordnung
        </summary>
        <p>{explanation.reference_scope}</p>
        <p>{explanation.method}</p>
        <p>{explanation.limitation}</p>
      </details>
      <button
        className="text-button"
        onClick={() =>
          download(
            new Blob(
              [
                JSON.stringify(
                  {
                    row_id: row.id,
                    source_row: row.id + 1,
                    original_values: row.values,
                    explanation,
                  },
                  null,
                  2,
                ),
              ],
              { type: "application/json" },
            ),
            `latentspace-zeile-${row.id + 1}.json`,
          )
        }
      >
        <ArrowDownToLine size={14} />
        Erklärung als JSON exportieren
      </button>
    </section>
  );
}
