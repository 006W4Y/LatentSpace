import { useEffect, useRef, useState } from "react";
import { X, CircleHelp, LoaderCircle, Sparkles } from "lucide-react";
import type {
  AnalysisConfig,
  Column,
  ColumnDisplay,
  Dataset,
  Role,
} from "../api";
import { number, roleLabels } from "../api";
import Field from "./Field";
const formatValue = (value: unknown) =>
  value == null
    ? "–"
    : typeof value === "number"
      ? number(value, 2)
      : String(value);
export default function ConfigDialog({
  dataset,
  initial,
  busy,
  onClose,
  onRun,
}: {
  dataset: Dataset;
  initial?: AnalysisConfig;
  busy: boolean;
  onClose: () => void;
  onRun: (config: AnalysisConfig) => void;
}) {
  const [roles, setRoles] = useState<Record<string, Role>>(
    initial?.roles ??
      Object.fromEntries(dataset.columns.map((c) => [c.name, c.role])),
  );
  const [features, setFeatures] = useState<string[]>(
    initial?.features ??
      dataset.columns
        .filter((c) => c.role === "number")
        .map((c) => c.name)
        .slice(0, 40),
  );
  const [projection, setProjection] = useState<"pca" | "umap">(
    initial?.projection ?? "pca",
  );
  const [minSize, setMinSize] = useState(initial?.min_cluster_size ?? 20);
  const [display, setDisplay] = useState<Record<string, ColumnDisplay>>(() =>
    Object.fromEntries(
      dataset.columns.map((column) => [
        column.name,
        {
          date_format: column.date_format_suggestion ?? null,
          month_base: "none",
          unit_label: "",
          ...initial?.display?.[column.name],
        },
      ]),
    ),
  );
  const needDateChoice = dataset.columns.some(
    (column) =>
      roles[column.name] === "date" && !display[column.name]?.date_format,
  );
  function configure(name: string, patch: Partial<ColumnDisplay>) {
    setDisplay((previous) => ({
      ...previous,
      [name]: { ...previous[name], ...patch },
    }));
  }
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, busy]);
  function changeRole(column: Column, role: Role) {
    setRoles((previous) => ({ ...previous, [column.name]: role }));
    if (!["number", "category"].includes(role))
      configure(column.name, { month_base: "none" });
    setFeatures((previous) =>
      role === "number"
        ? Array.from(new Set([...previous, column.name])).slice(0, 40)
        : previous.filter((name) => name !== column.name),
    );
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal config-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-title"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), select:not(:disabled), input:not(:disabled), [tabindex="0"]',
            ),
          );
          const first = focusable[0],
            last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">DATEN VORBEREITEN</span>
            <h2 id="config-title">Einmal prüfen. Dann entdecken.</h2>
            <p>
              {dataset.name} · {number(dataset.row_count, 0)} Zeilen
            </p>
          </div>
          <button
            ref={close}
            className="icon-button"
            aria-label="Schließen"
            onClick={onClose}
            disabled={busy}
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-content">
          <div className="info-box">
            <CircleHelp size={18} />
            <p>
              Rollen und Formate sind korrigierbare Vorschläge. Wähle
              Datumsfolgen und optionale Monatsdarstellungen ausdrücklich.
              Einheitenlabels sind Nutzereingaben; sie verändern keine Werte.
              Angehakte Messwerte werden für die Modellberechnung verwendet.
            </p>
          </div>
          {dataset.notices.map((notice) => (
            <p className="small-note" key={notice}>
              {notice}
            </p>
          ))}
          <div className="table-scroll">
            <table className="config-table">
              <thead>
                <tr>
                  <th>Spalte</th>
                  <th>Beispielwerte</th>
                  <th>Rolle</th>
                  <th>Darstellung und Format</th>
                  <th>Modellanalyse</th>
                </tr>
              </thead>
              <tbody>
                {dataset.columns.map((column) => (
                  <tr key={column.name}>
                    <td>
                      <strong>{column.name}</strong>
                      <small>
                        {column.missing} fehlend · {column.unique} verschieden
                      </small>
                    </td>
                    <td className="example-values">
                      {column.examples.map(formatValue).join(" · ") || "leer"}
                    </td>
                    <td>
                      <select
                        aria-label={`Rolle für ${column.name}`}
                        value={roles[column.name]}
                        onChange={(e) =>
                          changeRole(column, e.target.value as Role)
                        }
                      >
                        {Object.entries(roleLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="column-display-settings">
                      {roles[column.name] === "date" && (
                        <label className="field">
                          <span>Datumsfolge</span>
                          <select
                            aria-label={`Datumsformat für ${column.name}`}
                            value={display[column.name].date_format ?? ""}
                            onChange={(event) =>
                              configure(column.name, {
                                date_format: event.target
                                  .value as ColumnDisplay["date_format"],
                              })
                            }
                          >
                            <option value="" disabled>
                              Format auswählen
                            </option>
                            <option value="iso">Jahr-Monat-Tag (ISO)</option>
                            <option value="dmy">Tag/Monat/Jahr</option>
                            <option value="mdy">Monat/Tag/Jahr</option>
                          </select>
                          {column.date_ambiguous &&
                            !display[column.name].date_format && (
                              <small className="error-inline">
                                Mehrdeutige Reihenfolge
                              </small>
                            )}
                          <small>
                            ISO-Werte bleiben ISO. Zeitwerte werden in UTC
                            verglichen.
                          </small>
                        </label>
                      )}
                      <details>
                        <summary>Darstellung wählen</summary>
                        {["number", "category"].includes(roles[column.name]) &&
                          (column.month_choices?.length ?? 0) > 0 && (
                            <label className="field">
                              <span>Code-Darstellung</span>
                              <select
                                aria-label={`Monatsdarstellung für ${column.name}`}
                                value={display[column.name].month_base}
                                onChange={(event) =>
                                  configure(column.name, {
                                    month_base: event.target
                                      .value as ColumnDisplay["month_base"],
                                  })
                                }
                              >
                                <option value="none">
                                  Originale Codes / Zahlen
                                </option>
                                {column.month_choices?.includes("zero") && (
                                  <option value="zero">
                                    Monatsnamen · 0 = Januar
                                  </option>
                                )}
                                {column.month_choices?.includes("one") && (
                                  <option value="one">
                                    Monatsnamen · 1 = Januar
                                  </option>
                                )}
                              </select>
                            </label>
                          )}
                        <label className="field">
                          <span>Anzeige- / Einheitenlabel (Nutzereingabe)</span>
                          <input
                            maxLength={40}
                            aria-label={`Einheitenlabel für ${column.name}`}
                            value={display[column.name].unit_label}
                            onChange={(event) =>
                              configure(column.name, {
                                unit_label: event.target.value,
                              })
                            }
                          />
                        </label>
                      </details>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`${column.name} in Modellanalyse verwenden`}
                        checked={features.includes(column.name)}
                        disabled={
                          roles[column.name] !== "number" ||
                          (!features.includes(column.name) &&
                            features.length >= 40)
                        }
                        onChange={(e) =>
                          setFeatures((previous) =>
                            e.target.checked
                              ? [...previous, column.name]
                              : previous.filter((name) => name !== column.name),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-row">
            <Field label="Landschaft berechnen">
              <select
                value={projection}
                onChange={(e) =>
                  setProjection(e.target.value as "pca" | "umap")
                }
              >
                <option value="pca">PCA · schneller Einstieg</option>
                <option value="umap">UMAP · lokale Ähnlichkeiten</option>
              </select>
            </Field>
            <Field label="Mindestgröße einer Gruppe">
              <input
                type="number"
                min={3}
                max={1000}
                value={minSize}
                onChange={(e) => setMinSize(Number(e.target.value))}
              />
            </Field>
          </div>
          <p className="small-note">
            Fehlende Messwerte werden ausschließlich für die Modellanalyse mit
            dem Median ergänzt. UMAP kann beim ersten Start länger dauern.
            Maximal 40 Modellmerkmale. Ohne Zeitzonenangabe werden Zeitwerte als
            UTC gelesen.
          </p>
          {!features.length &&
            dataset.columns.some((c) => roles[c.name] === "number") && (
              <p className="error-inline">
                Wähle mindestens einen Messwert für die Modellanalyse.
              </p>
            )}
        </div>
        <div className="modal-footer">
          <button
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Abbrechen
          </button>
          <button
            className="button primary"
            disabled={
              busy ||
              needDateChoice ||
              !Number.isFinite(minSize) ||
              minSize < 3 ||
              minSize > 1000 ||
              (!features.length && Object.values(roles).includes("number"))
            }
            onClick={() =>
              onRun({
                roles,
                features,
                projection,
                min_cluster_size: minSize,
                display,
              })
            }
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}
            Analyse starten
          </button>
        </div>
      </section>
    </div>
  );
}
