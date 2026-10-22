import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, download, number, palette, post } from "../api";
import type {
  Investigation,
  InvestigationSource,
  ResearchRecord,
  Value,
} from "../api";
const valueText = (value: Value) =>
  value == null
    ? "–"
    : typeof value === "number"
      ? number(value, 4)
      : String(value);

export default function InvestigationPanel({
  source,
  onClose,
  onSaved,
}: {
  source: InvestigationSource;
  onClose: () => void;
  onSaved: () => void;
}) {
  const base =
    "savedId" in source
      ? `/research/${source.savedId}`
      : `/analyses/${source.job}/findings/${source.token}`;
  const [data, setData] = useState<Investigation | null>(null);
  const [mode, setMode] = useState<Investigation["mode"]>("affected");
  const [page, setPage] = useState(0);
  const [column, setColumn] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [savedId, setSavedId] = useState(
    "savedId" in source ? source.savedId : "",
  );
  const initialized = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setBusy(true);
    setError("");
    post<Investigation>(
      `${base}/investigate`,
      { mode, page, column },
      controller.signal,
    )
      .then((result) => {
        if (!active) return;
        setData(result);
        setBusy(false);
        if (!initialized.current) {
          setNotes(result.notes ?? "");
          setName((result.saved_name ?? result.finding.title).slice(0, 300));
          initialized.current = true;
        }
      })
      .catch((error) => {
        if (active && error.name !== "AbortError") {
          setError(error.message);
          setBusy(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [base, mode, page, column]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        const focusable = Array.from(
          dialogRef.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary",
          ) ?? [],
        ).filter((element) => element.getClientRects().length);
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", listener);
    return () => {
      window.removeEventListener("keydown", listener);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  async function save() {
    setSaving(true);
    setError("");
    try {
      if (savedId)
        await api(`/research/${savedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, notes }),
        });
      else {
        const record = await post<ResearchRecord>(`${base}/save`, {
          name,
          notes,
        });
        setSavedId(record.id);
      }
      setDirty(false);
      onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function exportFinding() {
    setSaving(true);
    setError("");
    try {
      const report = await post<unknown>(
        savedId ? `/research/${savedId}/report` : `${base}/report`,
        { name, notes },
      );
      download(
        new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        }),
        "latentspace-befund.json",
      );
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const columns = data
    ? Array.from(new Set([data.column, ...data.columns]))
    : [];
  const groups = data
    ? Array.from(new Set(data.scatter.map((point) => point.group))).sort()
    : [];
  return (
    <div className="modal-backdrop investigation-backdrop">
      <section
        ref={dialogRef}
        className="modal investigation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="investigation-title"
      >
        <header className="modal-heading">
          <div>
            <span className="eyebrow">
              BEFUNDWERKSTATT · FESTE VERGLEICHSBASIS
            </span>
            <h2 id="investigation-title">Befund untersuchen</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Befunduntersuchung schließen"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="modal-content">
          {error && (
            <p role="alert" className="error-inline">
              {error}
            </p>
          )}
          {busy && (
            <p role="status" className="investigation-loading">
              <LoaderCircle size={16} className="spin" /> Vergleich wird geladen
              …
            </p>
          )}
          {data && (
            <>
              <h3 className="investigation-headline">{data.finding.title}</h3>
              <p>{data.finding.detail}</p>
              <div className="reference-banner">
                <strong>
                  Referenz: {number(data.reference_count, 0)} Zeilen beim Finden
                </strong>
                <span>
                  Gilt unabhängig von späteren Arbeitsbereich-Filtern.
                  Auswahl-ID {data.finding.reference.id.slice(0, 8)}.
                </span>
              </div>
              <div className="investigation-stats">
                {data.summaries.map((group) => (
                  <article key={group.label}>
                    <span>{group.label}</span>
                    <strong>{number(group.count, 0)} Zeilen</strong>
                    <small>
                      {group.median != null
                        ? `Median ${number(group.median, 4)} · `
                        : ""}
                      {group.missing} fehlende Werte
                    </small>
                  </article>
                ))}
              </div>
              <label className="field investigation-column">
                <span>Vergleichsspalte</span>
                <select
                  disabled={busy}
                  value={data.column}
                  onChange={(event) => {
                    setColumn(event.target.value);
                    setPage(0);
                  }}
                >
                  {data.all_columns.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              {data.distribution.length > 0 && (
                <div className="investigation-chart">
                  <h3>Gemeinsame Verteilungsgrenzen · {data.column}</h3>
                  <p>
                    Zeilenzahlen je Bereich, keine normierten Anteile. Beide
                    Reihen verwenden dieselben Grenzen.
                  </p>
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={data.distribution}>
                      <CartesianGrid vertical={false} stroke="#e4eaf4" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        minTickGap={15}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        name="Referenz (enthält Befundzeilen)"
                        dataKey="reference"
                        fill="#acbcd9"
                      />
                      <Bar
                        name="Befundzeilen"
                        dataKey="affected"
                        fill="#df9a4a"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {data.scatter.length > 0 && (
                <div className="investigation-chart">
                  <h3>{data.scatter_columns.join(" / ")}</h3>
                  <p>
                    {data.scatter.length} von {data.scatter_total} vollständigen
                    Paaren.{" "}
                    {data.scatter.length < data.scatter_total
                      ? "Gleichmäßig über die Zeilen verteilte Anzeige, ergänzt um bis zu 100 Befundzeilen."
                      : "Alle vollständigen Paare."}
                  </p>
                  <ResponsiveContainer width="100%" height={270}>
                    <ScatterChart>
                      <CartesianGrid stroke="#e4eaf4" />
                      <XAxis
                        dataKey="x"
                        type="number"
                        name={data.scatter_columns[0]}
                        tick={{ fontSize: 10 }}
                      />
                      <YAxis
                        dataKey="y"
                        type="number"
                        name={data.scatter_columns[1]}
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter data={data.scatter}>
                        {data.scatter.map((point) => (
                          <Cell
                            key={point.row_id}
                            fill={
                              groups.length > 1
                                ? palette[
                                    groups.indexOf(point.group) % palette.length
                                  ]
                                : point.affected
                                  ? "#dc964c"
                                  : "#91a9d5"
                            }
                          />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                  {groups.length > 1 && (
                    <div className="scatter-legend">
                      {groups.map((group, i) => (
                        <span key={group}>
                          <i
                            style={{ background: palette[i % palette.length] }}
                          />
                          {group}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {data.comparison_groups.length > 0 && (
                <div className="table-scroll investigation-cohorts">
                  <h3>Vergleichsgruppen des Befunds</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Gruppe</th>
                        <th>Zeilen / Wertepaare</th>
                        <th>Fehlend</th>
                        <th>Fehlwertrate</th>
                        <th>Median / Mittel</th>
                        <th>Pearson r</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.comparison_groups.map((group, i) => (
                        <tr key={`${group.label}-${i}`}>
                          <td>{group.label}</td>
                          <td>{number(group.count, 0)}</td>
                          <td>{number(group.missing, 0)}</td>
                          <td>
                            {group.rate == null
                              ? "–"
                              : `${number(group.rate * 100, 1)} %`}
                          </td>
                          <td>{number(group.median ?? group.mean, 4)}</td>
                          <td>{number(group.correlation, 3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="finding-rules">
                <h3>Prüfregel & Auswahlbezug</h3>
                <p>{data.finding.method}</p>
                {data.finding.cell_evidence.map((rule) => (
                  <p key={rule.column}>
                    <strong>{rule.column}: </strong>
                    {rule.rule}
                    {rule.lower != null && rule.upper != null
                      ? ` · Unter ${number(rule.lower, 4)} oder über ${number(rule.upper, 4)} · Median ${number(rule.median, 4)}`
                      : ""}{" "}
                    · n = {rule.reference_n}
                  </p>
                ))}
                <p>{data.finding.limitation}</p>
              </div>
              <div
                className="investigation-row-controls"
                role="group"
                aria-label="Vergleichsauswahl"
              >
                {(
                  [
                    ["affected", "Befundzeilen"],
                    ["comparison", "Übrige Zeilen"],
                    ["reference", "Gesamte Referenz"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    className={`button small ${mode === value ? "primary" : "secondary"}`}
                    disabled={busy}
                    onClick={() => {
                      setMode(value);
                      setPage(0);
                    }}
                    key={value}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="value-evidence-legend">
                Farbige Zellen gehören zu diesem Befund und seiner festen
                Prüfregel. Die Modellmarkierung wird separat angezeigt.
              </p>
              <div className="table-scroll investigation-table">
                <table>
                  <thead>
                    <tr>
                      <th>Datenzeile</th>
                      <th>Modell</th>
                      {columns.map((name) => (
                        <th key={name}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.id}>
                        <td>#{row.id + 1}</td>
                        <td>{row.anomaly ? "Markiert" : "Unmarkiert"}</td>
                        {columns.map((name) => {
                          const rule = row.finding_evidence[name];
                          return (
                            <td
                              key={name}
                              data-feature={name}
                              className={
                                rule
                                  ? `finding-cell finding-cell-${rule.kind}`
                                  : ""
                              }
                              title={rule?.rule}
                            >
                              {valueText(row.values[name])}
                              {rule && (
                                <small>
                                  {rule.kind === "iqr"
                                    ? `Quartilsregel · Median ${number(rule.median, 4)}`
                                    : rule.kind === "missing"
                                      ? "Fehlender Wert im Befund"
                                      : rule.kind === "duplicate"
                                        ? "Schlüssel mehrfach"
                                        : "Seltene Kombination"}
                                </small>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.count && (
                <p>
                  Keine Zeilen in dieser Vergleichsauswahl. Das ist bei einem
                  Befund über alle Referenzzeilen möglich.
                </p>
              )}
              <div className="pagination">
                <span>
                  {number(data.count, 0)} Zeilen · Seite {data.page + 1}
                </span>
                <div>
                  <button
                    className="icon-button"
                    aria-label="Vorherige Befundseite"
                    disabled={busy || page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Nächste Befundseite"
                    disabled={busy || (page + 1) * 50 >= data.count}
                    onClick={() => setPage(page + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
              <div className="finding-notes">
                <h3>Für die weitere Untersuchung festhalten</h3>
                <label className="field">
                  <span>Befundname</span>
                  <input
                    maxLength={300}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setDirty(true);
                    }}
                  />
                </label>
                <label className="field">
                  <span>Notizen zum Befund</span>
                  <textarea
                    rows={3}
                    maxLength={10000}
                    value={notes}
                    onChange={(event) => {
                      setNotes(event.target.value);
                      setDirty(true);
                    }}
                    placeholder="Fachliche Einordnung, offene Fragen, nächster Prüfschritt …"
                  />
                </label>
                <div className="finding-note-actions">
                  <button
                    className="button primary"
                    disabled={saving || !name.trim()}
                    onClick={() => void save()}
                  >
                    <Bookmark size={15} />
                    {savedId
                      ? "Notizen speichern"
                      : "Befund dauerhaft speichern"}
                  </button>
                  <button
                    className="button secondary"
                    disabled={saving}
                    onClick={() => void exportFinding()}
                  >
                    <Download size={15} />
                    Befund als JSON exportieren
                  </button>
                  {savedId && (
                    <span className="saved-indicator">
                      {dirty
                        ? "Ungespeicherte Änderungen"
                        : "Lokal in der Datenbank gespeichert"}
                    </span>
                  )}
                </div>
              </div>
              <small className="fingerprint-note">
                Originalwerte · SHA-256 {data.fingerprint} · Export enthält
                sämtliche Befundzeilen und die Referenz-IDs.
              </small>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
