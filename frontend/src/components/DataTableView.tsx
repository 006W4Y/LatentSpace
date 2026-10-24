import { ArrowDownToLine, ChevronLeft, ChevronRight } from "lucide-react";
import { number } from "../api";
import type { DataRow, Exploration, Role } from "../api";
import EvidenceValue from "./EvidenceValue";
const formatValue = (value: unknown) =>
  value == null
    ? "–"
    : typeof value === "number"
      ? number(value, 2)
      : String(value);
export default function DataTableView({
  exploration,
  roles,
  inspectedId,
  page,
  exporting,
  onInspect,
  onPage,
  onExportCsv,
}: {
  exploration: Exploration;
  roles: Record<string, Role>;
  inspectedId: number | undefined;
  page: number;
  exporting: boolean;
  onInspect: (row: DataRow) => void;
  onPage: (page: number) => void;
  onExportCsv: () => Promise<void>;
}) {
  const selectedCount = exploration.count;
  return (
    <>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Deine Daten, Zeile für Zeile</h2>
            <p>
              Originalwerte · Seite {page + 1} von{" "}
              {Math.max(1, Math.ceil(selectedCount / 50))}
            </p>
          </div>
          <button
            className="button secondary small"
            disabled={exporting}
            onClick={() => void onExportCsv()}
          >
            <ArrowDownToLine size={15} />
            Auswahl exportieren
          </button>
        </div>
        <p className="value-evidence-legend">
          <span aria-hidden="true" />
          Orange markiert konkrete Wertabweichungen mit Vergleichsmedian. „Nur
          Modellmarkierung“ bedeutet: Modellmarkierung ohne belegten Einzelwert.
          Werte anklicken, um Prüfregel und Vergleichsbasis zu sehen.
        </p>
        {exploration.rows.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Zeile</th>
                  <th>Isolation Forest / Einzelwertregeln</th>
                  {Object.keys(roles).map((name) => (
                    <th key={name}>{name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exploration.rows.map((row) => (
                  <tr
                    key={row.id}
                    className={inspectedId === row.id ? "selected-row" : ""}
                  >
                    <td>
                      <button
                        className="row-link"
                        onClick={() => onInspect(row)}
                      >
                        #{row.id + 1}
                      </button>
                    </td>
                    <td>
                      {row.anomaly ? (
                        <div className="row-evidence-status">
                          <span className="badge orange">Modellmarkierung</span>
                          <small>
                            {row.explanation
                              ? row.explanation.reasons.length
                                ? `${row.explanation.reasons.length} Wert${row.explanation.reasons.length === 1 ? "" : "e"} markiert`
                                : "Nur Modellmarkierung · kein Einzelwert belegt"
                              : "Wertprüfung wird geladen …"}
                          </small>
                        </div>
                      ) : (
                        <span className="normal-status">Unmarkiert</span>
                      )}
                    </td>
                    {Object.keys(roles).map((name) => {
                      const reason = row.explanation?.reasons.find(
                        (item) => item.feature === name,
                      );
                      return (
                        <td
                          key={name}
                          data-feature={name}
                          className={reason ? "evidence-cell" : ""}
                          title={String(row.values[name] ?? "")}
                        >
                          {reason ? (
                            <EvidenceValue
                              reason={reason}
                              onInspect={() => onInspect(row)}
                            >
                              {formatValue(row.values[name])}
                            </EvidenceValue>
                          ) : (
                            formatValue(row.values[name])
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Keine Zeilen in dieser Auswahl.</h3>
            <p>Setze einen Filter zurück, um mehr Daten zu sehen.</p>
          </div>
        )}
        <div className="pagination">
          <span>{number(selectedCount, 0)} Zeilen in deiner Auswahl</span>
          <div>
            <button
              className="icon-button"
              aria-label="Vorherige Seite"
              disabled={page === 0}
              onClick={() => onPage(page - 1)}
            >
              <ChevronLeft size={18} />
            </button>
            <span>{page + 1}</span>
            <button
              className="icon-button"
              aria-label="Nächste Seite"
              disabled={(page + 1) * 50 >= selectedCount}
              onClick={() => onPage(page + 1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
