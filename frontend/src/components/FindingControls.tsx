import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ExploreConfig, Exploration } from "../api";
export default function FindingControls({
  config,
  coverage,
  busy,
  onChange,
}: {
  config: ExploreConfig;
  coverage: Exploration["coverage"];
  busy: boolean;
  onChange: (patch: Partial<ExploreConfig>) => void;
}) {
  return (
    <section className="finding-controls">
      <p>
        <strong>{coverage.candidates} gefunden</strong> · {coverage.matched}{" "}
        nach Themen-/Verfahrensfilter · {coverage.shown} angezeigt (ab{" "}
        {coverage.matched ? coverage.offset + 1 : 0})
      </p>
      <div className="finding-control-fields">
        <label className="field">
          <span>Sortieren nach</span>
          <select
            aria-label="Befunde sortieren nach"
            value={config.finding_sort}
            disabled={busy}
            onChange={(event) =>
              onChange({
                finding_sort: event.target
                  .value as ExploreConfig["finding_sort"],
              })
            }
          >
            <option value="name">Bezeichnung (alphabetisch)</option>
            <option value="effect">
              Numerischer Unterschied / Referenz-IQR
            </option>
            <option value="strength">
              Zusammenhangsstärke (absolutes Pearson r)
            </option>
            <option value="sample_size">
              Stichprobengröße (vollständige Zeilen)
            </option>
            <option value="coverage">
              Datenabdeckung (vollständiger Anteil)
            </option>
          </select>
        </label>
        <label className="field">
          <span>Richtung</span>
          <select
            aria-label="Befund-Sortierrichtung"
            value={config.finding_direction}
            disabled={busy}
            onChange={(event) =>
              onChange({
                finding_direction: event.target
                  .value as ExploreConfig["finding_direction"],
              })
            }
          >
            <option value="asc">Aufsteigend</option>
            <option value="desc">Absteigend</option>
          </select>
        </label>
        <label className="field">
          <span>Ergebnisart</span>
          <select
            aria-label="Ergebnisart filtern"
            value={config.finding_origin}
            disabled={busy}
            onChange={(event) =>
              onChange({
                finding_origin: event.target
                  .value as ExploreConfig["finding_origin"],
              })
            }
          >
            <option value="all">Alle Arten</option>
            <option value="observation">Beobachtungen</option>
            <option value="rule">Suchregeln</option>
            <option value="model">Modellmarkierungen</option>
          </select>
        </label>
        <label className="field">
          <span>Pro Seite</span>
          <select
            aria-label="Befunde pro Seite"
            disabled={busy}
            value={config.finding_limit}
            onChange={(event) =>
              onChange({ finding_limit: Number(event.target.value) })
            }
          >
            {[10, 20, 40, 100].map((count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="sorting-note">
        Die Sortierung verwendet das ausgewiesene Rechenmaß und keine fachliche
        Wichtigkeit. Nicht verfügbare Maße stehen am Ende. Unterschiede sind
        durch den jeweiligen Referenz-IQR geteilt; Zusammenhangsstärken sind
        absolute Pearson-Werte. Gruppengrundlagen stehen beim Befund. Bei vielen
        Vergleichen können Suchtreffer auch in unabhängigen Zufallsdaten
        auftreten.
      </p>
      <div className="pagination">
        <span>
          Seite {Math.floor(config.finding_offset / config.finding_limit) + 1}{" "}
          von {Math.max(1, Math.ceil(coverage.matched / config.finding_limit))}
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="Vorherige Befundliste"
            disabled={busy || config.finding_offset === 0}
            onClick={() =>
              onChange({
                finding_offset: Math.max(
                  0,
                  config.finding_offset - config.finding_limit,
                ),
              })
            }
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="icon-button"
            aria-label="Nächste Befundliste"
            disabled={
              busy ||
              config.finding_offset + config.finding_limit >= coverage.matched
            }
            onClick={() =>
              onChange({
                finding_offset: config.finding_offset + config.finding_limit,
              })
            }
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
