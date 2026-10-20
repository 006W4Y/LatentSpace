import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleHelp,
  Database,
  FileSpreadsheet,
  Filter,
  GitBranch,
  Globe2,
  Layers3,
  LayoutDashboard,
  LoaderCircle,
  Network,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, clusterColor, download, number, post, roleLabels } from "./api";
import type {
  Analysis,
  AnalysisConfig,
  Column,
  DataRow,
  Dataset,
  Exploration,
  ExploreConfig,
  Role,
} from "./api";
import Landscape from "./components/Landscape";
import InsightFeed, { variedInsights } from "./components/InsightFeed";
import ProfileCard from "./components/ProfileCard";
import ExplanationPanel from "./components/ExplanationPanel";
import ReportActions from "./components/ReportActions";
import type { Insight } from "./api";

type View =
  | "overview"
  | "insights"
  | "trends"
  | "groups"
  | "anomalies"
  | "relations"
  | "landscape"
  | "data";
const navigation: {
  id: View;
  label: string;
  icon: typeof Activity;
  description: string;
}[] = [
  {
    id: "overview",
    label: "Übersicht",
    icon: LayoutDashboard,
    description: "Ein erster Blick auf das, was in deinen Daten steckt.",
  },
  {
    id: "insights",
    label: "Insights",
    icon: Sparkles,
    description:
      "Automatisch entdeckte Muster mit konkreten Belegen und Vergleichswerten.",
  },
  {
    id: "trends",
    label: "Trends & Zeit",
    icon: TrendingUp,
    description: "Entdecke Entwicklungen und vergleiche Zeiträume.",
  },
  {
    id: "groups",
    label: "Gruppen",
    icon: Layers3,
    description: "Vergleiche Kategorien und erkunde ähnliche Datensätze.",
  },
  {
    id: "anomalies",
    label: "Auffälligkeiten",
    icon: Activity,
    description: "Finde ungewöhnliche Kombinationen deiner Messwerte.",
  },
  {
    id: "relations",
    label: "Zusammenhänge",
    icon: GitBranch,
    description: "Untersuche, welche Merkmale sich gemeinsam verändern.",
  },
  {
    id: "landscape",
    label: "Datenlandschaft",
    icon: Globe2,
    description: "Entdecke deine Daten aus einer anderen Perspektive.",
  },
  {
    id: "data",
    label: "Datentabelle",
    icon: Table2,
    description: "Prüfe einzelne Zeilen und ihre ursprünglichen Werte.",
  },
];
const emptyExplore: ExploreConfig = {
  query: "",
  category_column: null,
  category_value: null,
  anomalies_only: false,
  cluster: null,
  row_ids: null,
  date_column: null,
  value_column: null,
  group_column: null,
  period: "month",
  aggregation: "sum",
  page: 0,
};
const formatValue = (value: unknown) =>
  value == null
    ? "–"
    : typeof value === "number"
      ? number(value, 2)
      : String(value);

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <BarChart3 size={28} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Metric({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <Card className="metric">
      <div className="metric-top">
        <span>{label}</span>
        <Icon size={17} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>
  );
}
function Illustration() {
  const dots = useMemo(
    () =>
      Array.from({ length: 135 }, (_, i) => {
        const cluster = i % 3;
        const angle = i * 2.39996;
        const radius = Math.sqrt(i / 3) * 10;
        return {
          x:
            [135, 280, 395][cluster] +
            Math.cos(angle) * radius * [1, 0.8, 1.1][cluster],
          y: [180, 95, 220][cluster] + Math.sin(angle) * radius * 0.75,
          color: ["#8fae84", "#dca67a", "#a7a0c7"][cluster],
        };
      }),
    [],
  );
  return (
    <svg
      className="illustration"
      viewBox="0 0 540 330"
      aria-label="Illustration einer Datenlandschaft"
    >
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="#c4d0bf" />
        </pattern>
      </defs>
      <rect width="540" height="330" fill="url(#grid)" />
      <ellipse cx="135" cy="180" rx="94" ry="74" fill="#e6eedf" />
      <ellipse cx="280" cy="95" rx="83" ry="64" fill="#f3e8d9" />
      <ellipse cx="395" cy="220" rx="97" ry="78" fill="#eae7ee" />
      {dots.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={i % 9 === 0 ? 4.5 : 3}
          fill={dot.color}
          opacity={0.85}
        />
      ))}
      <circle cx="270" cy="255" r="7" fill="#d28058" />
      <circle
        cx="270"
        cy="255"
        r="13"
        stroke="#d28058"
        fill="none"
        opacity="0.4"
      />
      <rect
        x="290"
        y="250"
        width="142"
        height="46"
        rx="10"
        fill="white"
        stroke="#dfe4da"
      />
      <text x="304" y="270" fontSize="11" fontWeight="600" fill="#263c31">
        Neue Perspektiven.
      </text>
      <text x="304" y="286" fontSize="10" fill="#7c8679">
        Illustrative Datenansicht
      </text>
    </svg>
  );
}

function ConfigDialog({
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
              Eine Kennung wie eine Kundennummer ist kein Messwert. Prüfe die
              vorgeschlagenen Rollen. Angehakte Messwerte fließen in Cluster,
              Anomalien und die Landschaft ein.
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
            Maximal 40 Modellmerkmale.
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
              !Number.isFinite(minSize) ||
              minSize < 3 ||
              minSize > 1000 ||
              (!features.length && Object.values(roles).includes("number"))
            }
            onClick={() =>
              onRun({ roles, features, projection, min_cluster_size: minSize })
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

export default function App() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [job, setJob] = useState<string | null>(null);
  const [exploration, setExploration] = useState<Exploration | null>(null);
  const [config, setConfig] = useState<ExploreConfig>(emptyExplore);
  const [view, setView] = useState<View>("overview");
  const [busy, setBusy] = useState(false);
  const [exploring, setExploring] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [pending, setPending] = useState<Dataset | null>(null);
  const [decimal, setDecimal] = useState(".");
  const [inspected, setInspected] = useState<DataRow | null>(null);
  const [chartFeature, setChartFeature] = useState("");
  const [saved, setSaved] = useState<
    { name: string; dataset: string; config: ExploreConfig; view: View }[]
  >(() => {
    try {
      return JSON.parse(localStorage.getItem("latentspace-views") || "[]");
    } catch {
      return [];
    }
  });
  const [showHelp, setShowHelp] = useState(false);
  const generation = useRef(0);
  const uploadInput = useRef<HTMLInputElement>(null);
  const refreshDatasets = useCallback(
    () =>
      api<Dataset[]>("/datasets")
        .then(setDatasets)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void refreshDatasets();
  }, [refreshDatasets]);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!job) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => {
      setExploring(true);
      post<Exploration>(`/analyses/${job}/explore`, config, controller.signal)
        .then((result) => {
          if (active) {
            setExploration(result);
            setExploring(false);
          }
        })
        .catch((e) => {
          if (active && e.name !== "AbortError") {
            setError(e.message);
            setExploring(false);
          }
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [job, config]);

  function exploreInsight(insight: Insight) {
    const { view: target, ...settings } = insight.action;
    update({
      ...settings,
      ...(insight.row_ids.length ? { row_ids: insight.row_ids } : {}),
    });
    setView(target);
  }

  function update(patch: Partial<ExploreConfig>) {
    setConfig((previous) => ({ ...previous, ...patch, page: patch.page ?? 0 }));
  }
  async function run(selected: Dataset, options?: AnalysisConfig) {
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setPending(null);
    setShowImport(false);
    setDataset(selected);
    setInspected(null);
    setAnalysis(null);
    setExploration(null);
    setJob(null);
    const settings = options ?? {
      roles: Object.fromEntries(selected.columns.map((c) => [c.name, c.role])),
      features: selected.columns
        .filter((c) => c.role === "number")
        .map((c) => c.name)
        .slice(0, 40),
      projection: "pca",
      min_cluster_size: 20,
    };
    try {
      const started = await post<{ id: string }>(
        `/datasets/${selected.id}/analyses`,
        settings,
      );
      const deadline = Date.now() + 10 * 60 * 1000;
      while (Date.now() < deadline) {
        if (generation.current !== current) return;
        const status = await api<{ status: string; error?: string }>(
          `/analyses/${started.id}`,
        );
        if (status.status === "failed") throw new Error(status.error);
        if (status.status === "done") {
          const result = await api<Analysis>(`/analyses/${started.id}/result`);
          if (generation.current !== current) return;
          const dates = Object.keys(result.roles).filter(
            (name) => result.roles[name] === "date",
          );
          const groups = Object.keys(result.roles).filter(
            (name) => result.roles[name] === "category",
          );
          setConfig({
            ...emptyExplore,
            date_column: dates[0] ?? null,
            value_column: result.numeric_columns[0] ?? null,
            group_column: groups[0] ?? null,
          });
          setChartFeature(result.numeric_columns[0] ?? "");
          setAnalysis(result);
          setJob(started.id);
          setView("overview");
          setBusy(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      throw new Error(
        "Die Analyse dauert länger als erwartet. Bitte später erneut starten.",
      );
    } catch (e) {
      if (generation.current === current) {
        setError((e as Error).message);
        setBusy(false);
      }
    }
  }

  async function loadDemo() {
    setBusy(true);
    setError("");
    try {
      const created = await api<Dataset>("/datasets/demo", { method: "POST" });
      await refreshDatasets();
      await run(created);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setError("Bitte eine Datei mit höchstens 20 MB auswählen.");
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("decimal", decimal);
    try {
      const imported = await api<Dataset>("/datasets", {
        method: "POST",
        body: form,
      });
      setPending(imported);
      setShowImport(false);
      await refreshDatasets();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (uploadInput.current) uploadInput.current.value = "";
    }
  }
  async function exportCsv() {
    if (!job) return;
    setExporting(true);
    try {
      const response = await fetch(`/api/analyses/${job}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok)
        throw new Error("Export fehlgeschlagen. Bitte erneut versuchen.");
      download(await response.blob(), "latentspace-auswahl.csv");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  async function removeDataset(item: Dataset) {
    if (
      !window.confirm(`„${item.name}“ und zugehörige Analysen lokal löschen?`)
    )
      return;
    try {
      await api(`/datasets/${item.id}`, { method: "DELETE" });
      const next = saved.filter((s) => s.dataset !== item.id);
      setSaved(next);
      localStorage.setItem("latentspace-views", JSON.stringify(next));
      if (dataset?.id === item.id) {
        generation.current++;
        setDataset(null);
        setAnalysis(null);
        setJob(null);
        setExploration(null);
        setInspected(null);
      }
      await refreshDatasets();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function saveView() {
    if (!dataset) return;
    const name = window
      .prompt(
        "Wie soll diese Ansicht heißen?",
        `${navigation.find((v) => v.id === view)?.label} · ${dataset.name}`,
      )
      ?.trim();
    if (!name) return;
    const next = [...saved, { name, dataset: dataset.id, config, view }].slice(
      -20,
    );
    try {
      localStorage.setItem("latentspace-views", JSON.stringify(next));
      setSaved(next);
      setMessage("Ansicht in diesem Browser gespeichert.");
    } catch {
      setError("Die Ansicht konnte im Browser nicht gespeichert werden.");
    }
  }

  const activeNavigation = navigation.find((v) => v.id === view)!;
  const numeric = analysis?.numeric_columns ?? [];
  const categories = analysis
    ? Object.keys(analysis.roles).filter(
        (name) => analysis.roles[name] === "category",
      )
    : [];
  const dates = analysis
    ? Object.keys(analysis.roles).filter(
        (name) => analysis.roles[name] === "date",
      )
    : [];
  const visibleRows = useMemo(() => {
    if (!analysis || !exploration) return [];
    const ids = new Set(exploration.filtered_ids);
    return analysis.rows.filter((row) => ids.has(row.id));
  }, [analysis, exploration]);
  const filtered = !!(
    config.query ||
    config.category_value !== null ||
    config.anomalies_only ||
    config.cluster !== null ||
    config.row_ids !== null
  );
  const featureProfile = exploration?.profiles.find(
    (p) => p.name === chartFeature,
  );
  const selectedCount = exploration?.count ?? 0;
  const settingsSameDataset = pending?.id === analysis?.dataset_id;
  const closeConfig = useCallback(() => setPending(null), []);

  const valueSelect = (
    <Field label="Messwert">
      <select
        value={config.value_column ?? ""}
        onChange={(e) => update({ value_column: e.target.value || null })}
      >
        <option value="">Messwert wählen</option>
        {numeric.map((name) => (
          <option key={name}>{name}</option>
        ))}
      </select>
    </Field>
  );
  const aggregationSelect = (
    <Field label="Darstellung">
      <select
        value={config.aggregation}
        onChange={(e) => update({ aggregation: e.target.value })}
      >
        <option value="sum">Summe</option>
        <option value="mean">Durchschnitt</option>
        <option value="median">Median</option>
        <option value="count">Anzahl Zeilen</option>
      </select>
    </Field>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => {
            if (!busy) {
              setView("overview");
              if (!analysis) setDataset(null);
            }
          }}
          aria-label="LatentSpace Start"
        >
          <span className="brand-mark">
            <Network size={23} />
          </span>
          <span>
            Latent<span className="brand-light">Space</span>
            <small>DEINE DATEN. NEUE PERSPEKTIVEN.</small>
          </span>
        </button>
        <div className="workspace-label">
          <span className="workspace-avatar">L</span>
          <div>
            Mein Arbeitsbereich<small>Lokal auf diesem Gerät</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">ENTDECKEN</span>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.id}
              aria-label={item.label}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              disabled={!analysis || busy}
              onClick={() => setView(item.id)}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
              {item.id === "anomalies" && analysis && (
                <small>{number(analysis.anomaly_count, 0)}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-section">
          <span className="nav-label">MEINE DATENSÄTZE</span>
          <button
            className="icon-button"
            aria-label="Datensatz importieren"
            disabled={busy}
            onClick={() => setShowImport(true)}
          >
            <Plus size={15} />
          </button>
        </div>
        <div className="dataset-list">
          {datasets.map((item) => (
            <div
              key={item.id}
              className={`dataset-item ${dataset?.id === item.id ? "selected" : ""}`}
            >
              <button
                disabled={busy}
                title={item.name}
                onClick={() => void run(item)}
              >
                <FileSpreadsheet size={16} />
                <span>
                  {item.name}
                  <small>{number(item.row_count, 0)} Zeilen</small>
                </span>
              </button>
              <button
                disabled={busy}
                className="delete-dataset"
                aria-label={`${item.name} löschen`}
                onClick={() => void removeDataset(item)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {!datasets.length && (
            <p className="sidebar-empty">
              Deine Datensätze erscheinen hier nach dem Import.
            </p>
          )}
        </div>
        {analysis && saved.some((item) => item.dataset === dataset?.id) && (
          <>
            <span className="nav-label saved-label">
              GESPEICHERTE ANSICHTEN
            </span>
            {saved
              .filter((item) => item.dataset === dataset?.id)
              .map((item, i) => (
                <button
                  key={i}
                  className="saved-view"
                  onClick={() => {
                    setConfig(item.config);
                    setView(item.view);
                  }}
                >
                  <Bookmark size={14} />
                  <span>{item.name}</span>
                </button>
              ))}
          </>
        )}
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={18} />
            <div>
              Deine Daten bleiben hier.<small>Keine externen KI-Dienste.</small>
            </div>
          </div>
          <button
            className="help-button"
            onClick={() => setShowHelp(!showHelp)}
          >
            <CircleHelp size={16} />
            So funktioniert LatentSpace
            <ArrowUpRight size={14} />
          </button>
          <span className="version">
            LATENTSPACE <span>v0.2 · INSIGHTS</span>
          </span>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Arbeitsbereich<span>/</span>
            <strong>{analysis ? activeNavigation.label : "Willkommen"}</strong>
          </div>
          <div className="topbar-actions">
            <span className="local-badge">
              <i className="status-dot" />
              Lokal
            </span>
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => setShowImport(true)}
            >
              <Plus size={16} />
              Daten importieren
            </button>
          </div>
        </header>
        {error && (
          <div className="alert error" role="alert">
            <Activity size={18} />
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Fehlermeldung schließen"
              onClick={() => setError("")}
            >
              <X size={17} />
            </button>
          </div>
        )}
        {message && (
          <div className="toast" role="status">
            <Check size={16} />
            {message}
          </div>
        )}
        {showHelp && (
          <div className="help-panel">
            <div>
              <strong>Von der Datei zur Erkenntnis</strong>
              <p>
                Importiere eine Tabelle, prüfe die Spaltenrollen und starte die
                Analyse. Filter gelten für alle Ansichten. Cluster und
                Auffälligkeiten beziehen sich immer auf den gesamten Datensatz
                und die ausgewählten Modellmerkmale. Sie werden durch Filter
                nicht neu trainiert.
              </p>
              <p>
                Gespeicherte Ansichten enthalten Filter und Tab im Browser.
                Datensätze bleiben lokal gespeichert; Analyseergebnisse werden
                nach einem Serverneustart neu berechnet. Das Werkzeug ist für
                den lokalen Einzelbetrieb gedacht.
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Hilfe schließen"
              onClick={() => setShowHelp(false)}
            >
              <X size={18} />
            </button>
          </div>
        )}

        {busy ? (
          <div className="loading-workspace" role="status">
            <div className="loading-orbit">
              <Network size={34} />
            </div>
            <span className="eyebrow">EIN NEUER BLICK AUF DEINE DATEN</span>
            <h2>
              {dataset
                ? "Deine Daten nehmen Form an."
                : "Deine Daten werden vorbereitet."}
            </h2>
            <p>
              Wir prüfen die Merkmale, suchen Gruppen und berechnen
              Auffälligkeiten.
              <br />
              Die erste UMAP-Berechnung kann etwas länger dauern.
            </p>
            <LoaderCircle className="spin" size={23} />
          </div>
        ) : !analysis ? (
          <div className="welcome content">
            <div className="page-heading">
              <div>
                <span className="eyebrow">
                  WILLKOMMEN IN DEINER DATENWERKSTATT
                </span>
                <h1>In deinen Daten steckt mehr.</h1>
                <p>
                  Entdecke Muster, stelle Fragen und finde heraus, was wirklich
                  auffällt.
                </p>
              </div>
              <Badge>Explorative Datenanalyse</Badge>
            </div>
            <Card className="welcome-hero">
              <div className="hero-copy">
                <Badge tone="green">
                  <Sparkles size={12} />
                  VON ZAHLEN ZU ERKENNTNISSEN
                </Badge>
                <h2>
                  Eine Datei.
                  <br />
                  Viele neue Perspektiven.
                </h2>
                <p>
                  Verwandle deine Tabellen in verständliche Trends, Gruppen und
                  interaktive Datenlandschaften. Ohne eine Zeile Code.
                </p>
                <div className="hero-actions">
                  <button
                    className="button primary"
                    onClick={() => setShowImport(true)}
                  >
                    <Upload size={17} />
                    Eigene Daten erkunden
                  </button>
                  <button
                    className="text-button"
                    onClick={() => void loadDemo()}
                  >
                    Mit Beispieldaten starten
                    <ArrowRight size={16} />
                  </button>
                </div>
                <small>
                  <ShieldCheck size={14} />
                  CSV und Excel · lokal verarbeitet · kein Konto nötig
                </small>
              </div>
              <div className="hero-visual">
                <Illustration />
                <span className="visual-label">
                  <i className="status-dot" />
                  RAUM FÜR ENTDECKUNGEN
                </span>
              </div>
            </Card>
            <div className="section-heading">
              <div>
                <h2>Was möchtest du herausfinden?</h2>
                <p>Ein Werkzeug für jede neue Frage.</p>
              </div>
              <span className="subtle">
                Deine Reise beginnt mit einem Datensatz.
              </span>
            </div>
            <div className="question-grid">
              {[
                {
                  icon: TrendingUp,
                  title: "Was verändert sich?",
                  copy: "Trends und Entwicklungen über die Zeit verstehen.",
                  tone: "sage",
                },
                {
                  icon: Layers3,
                  title: "Welche Gruppen gibt es?",
                  copy: "Ähnliche Beispiele und Unterschiede entdecken.",
                  tone: "sand",
                },
                {
                  icon: Activity,
                  title: "Was fällt auf?",
                  copy: "Ungewöhnliche Werte und Kombinationen prüfen.",
                  tone: "lavender",
                },
              ].map((item) => (
                <Card key={item.title} className="question-card">
                  <span className={`feature-icon ${item.tone}`}>
                    <item.icon size={23} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                  <button
                    className="text-button"
                    onClick={() => setShowImport(true)}
                  >
                    Daten hinzufügen
                    <ArrowUpRight size={16} />
                  </button>
                </Card>
              ))}
            </div>
            <div className="welcome-footer">
              <span>
                <span className="step-number">01</span>Tabelle importieren
              </span>
              <ArrowRight size={15} />
              <span>
                <span className="step-number">02</span>Spalten kurz prüfen
              </span>
              <ArrowRight size={15} />
              <span>
                <span className="step-number">03</span>Zusammenhänge entdecken
              </span>
            </div>
          </div>
        ) : (
          <div
            className={`content workspace ${inspected ? "with-inspector" : ""}`}
          >
            <div className="page-heading">
              <div>
                <span className="eyebrow">{dataset?.name}</span>
                <h1>
                  {activeNavigation.label}
                  <span className="heading-dot">.</span>
                </h1>
                <p>{activeNavigation.description}</p>
              </div>
              <div className="heading-actions">
                {job && (
                  <ReportActions job={job} config={config} onError={setError} />
                )}
                <button
                  className="button secondary small"
                  onClick={() => setPending(dataset)}
                >
                  <SlidersHorizontal size={15} />
                  Analyse einstellen
                </button>
                <button
                  className="button secondary small"
                  onClick={saveView}
                  title="Filter und Ansicht im Browser speichern"
                >
                  <Bookmark size={15} />
                  Ansicht merken
                </button>
              </div>
            </div>
            <div className="filterbar">
              <div className="search-field">
                <Search size={16} />
                <input
                  aria-label="Datensatz durchsuchen"
                  placeholder="In deinen Daten suchen …"
                  value={config.query}
                  onChange={(e) => update({ query: e.target.value })}
                />
              </div>
              <div className="filter-control">
                <Filter size={14} />
                <select
                  aria-label="Filterspalte"
                  value={config.category_column ?? ""}
                  onChange={(e) =>
                    update({
                      category_column: e.target.value || null,
                      category_value: null,
                    })
                  }
                >
                  <option value="">Kategorie filtern</option>
                  {categories.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </div>
              {config.category_column && (
                <select
                  aria-label="Filterwert"
                  value={config.category_value ?? ""}
                  onChange={(e) =>
                    update({ category_value: e.target.value || null })
                  }
                >
                  <option value="">Alle Werte</option>
                  {Array.from(
                    new Set(
                      analysis.rows
                        .map(
                          (row) =>
                            row.values[config.category_column!] as string,
                        )
                        .filter((value) => value != null),
                    ),
                  )
                    .sort()
                    .map((value) => (
                      <option key={String(value)} value={String(value)}>
                        {String(value)}
                      </option>
                    ))}
                </select>
              )}
              <label
                className={`toggle-filter ${config.anomalies_only ? "checked" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={config.anomalies_only}
                  onChange={(e) => update({ anomalies_only: e.target.checked })}
                />
                <Activity size={14} />
                Nur auffällige
              </label>
              <span className="filter-count">
                {exploring && <LoaderCircle size={12} className="spin" />}
                {number(selectedCount, 0)} / {number(analysis.rows.length, 0)}{" "}
                Zeilen
              </span>
              <button
                className="icon-button"
                aria-label="Auswahl als CSV exportieren"
                title="Auswahl als CSV exportieren"
                disabled={exporting}
                onClick={() => void exportCsv()}
              >
                {exporting ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <ArrowDownToLine size={17} />
                )}
              </button>
            </div>
            {filtered && (
              <div className="active-filters">
                <span>
                  <Filter size={13} />
                  Auswahl gilt für alle Ansichten
                </span>
                {config.cluster !== null && (
                  <Badge>
                    Gruppe{" "}
                    {config.cluster < 0 ? "ohne Zuordnung" : config.cluster + 1}
                  </Badge>
                )}
                {config.row_ids !== null && (
                  <Badge>{config.row_ids.length} markierte Punkte</Badge>
                )}
                <button
                  className="text-button"
                  onClick={() =>
                    update({
                      query: "",
                      category_column: null,
                      category_value: null,
                      anomalies_only: false,
                      cluster: null,
                      row_ids: null,
                    })
                  }
                >
                  <X size={13} />
                  Filter zurücksetzen
                </button>
              </div>
            )}
            {!exploration ? (
              <div className="initial-loading">
                <LoaderCircle className="spin" size={26} />
                <p>Ansichten werden vorbereitet …</p>
              </div>
            ) : (
              <div
                className={
                  exploring ? "analysis-content refreshing" : "analysis-content"
                }
                aria-busy={exploring}
              >
                {view === "overview" && (
                  <>
                    <div className="metrics-grid">
                      <Metric
                        label="Datenzeilen"
                        value={number(selectedCount, 0)}
                        detail={`${analysis.rows.length === selectedCount ? "Gesamter Datensatz" : "In deiner aktuellen Auswahl"}`}
                        icon={Database}
                      />
                      <Metric
                        label="Merkmale"
                        value={number(Object.keys(analysis.roles).length, 0)}
                        detail={`${numeric.length} numerische Messwerte`}
                        icon={SlidersHorizontal}
                      />
                      <Metric
                        label="Entdeckte Gruppen"
                        value={number(
                          exploration.clusters.filter((c) => c.cluster >= 0)
                            .length,
                          0,
                        )}
                        detail="HDBSCAN · Merkmalsraum"
                        icon={Layers3}
                      />
                      <Metric
                        label="Auffällige Zeilen"
                        value={number(exploration.anomaly_count, 0)}
                        detail="Zur genaueren Prüfung"
                        icon={Activity}
                      />
                    </div>
                    <div className="section-heading discoveries-heading">
                      <div>
                        <span className="eyebrow">
                          AUTOMATISCH ERKANNT · MIT VERGLEICHSWERTEN
                        </span>
                        <h2>Was deine Daten zeigen</h2>
                        <p>
                          Konkrete Befunde für deine aktuelle Auswahl. Jeder
                          Hinweis ist überprüfbar.
                        </p>
                      </div>
                      <button
                        className="button secondary small"
                        onClick={() => setView("insights")}
                      >
                        Alle {exploration.insights.length} Insights
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    <InsightFeed
                      items={variedInsights(exploration.insights)}
                      onExplore={exploreInsight}
                      compact
                    />
                    <div className="overview-grid">
                      <Card className="landscape-card">
                        <div className="card-heading">
                          <div>
                            <span className="eyebrow">
                              EIN BLICK AUFS GANZE
                            </span>
                            <h2>Deine Datenlandschaft</h2>
                          </div>
                          <Badge>{analysis.projection.toUpperCase()}</Badge>
                        </div>
                        <Landscape
                          rows={visibleRows}
                          compact
                          onInspect={setInspected}
                          onSelect={(ids) => update({ row_ids: ids })}
                          selected={inspected?.id ?? null}
                        />
                        <div className="card-bottom">
                          <div className="legend">
                            <span>
                              <i style={{ background: "#4e77c9" }} />
                              Farbe = Gruppe
                            </span>
                            <span>
                              <i className="ring" />
                              Ring = auffällig
                            </span>
                          </div>
                          <button
                            className="text-button"
                            onClick={() => setView("landscape")}
                          >
                            Landschaft erkunden
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </Card>
                      <Card className="insights-card exploration-guide">
                        <div className="card-heading">
                          <div>
                            <span className="eyebrow">
                              VOM BEFUND ZUR PRÜFUNG
                            </span>
                            <h2>Entdecken. Verstehen. Weitergeben.</h2>
                          </div>
                          <Sparkles size={20} />
                        </div>
                        <button
                          className="guide-step"
                          onClick={() => setView("anomalies")}
                        >
                          <span>01</span>
                          <div>
                            <strong>Abweichungen begründen</strong>
                            <p>
                              Messwerte mit Median, Quartilen und ähnlichen
                              Zeilen vergleichen.
                            </p>
                          </div>
                          <ArrowUpRight size={17} />
                        </button>
                        <button
                          className="guide-step"
                          onClick={() => setView("groups")}
                        >
                          <span>02</span>
                          <div>
                            <strong>Gruppen auseinanderhalten</strong>
                            <p>
                              Verteilungen und Gruppenprofile im Zusammenhang
                              untersuchen.
                            </p>
                          </div>
                          <ArrowUpRight size={17} />
                        </button>
                        <div className="guide-step">
                          <span>03</span>
                          <div>
                            <strong>Erkenntnisse übergeben</strong>
                            <p>
                              Bericht, Methoden und Zeilenbezug für die
                              fachliche Weiteranalyse exportieren.
                            </p>
                          </div>
                        </div>
                        <div className="insights-note">
                          <ShieldCheck size={14} />
                          Deine Originaldaten bleiben unverändert.
                        </div>
                      </Card>
                    </div>
                    <div className="section-heading">
                      <div>
                        <h2>Deine Merkmale im Überblick</h2>
                        <p>
                          Sinnvoll beschriftete Verteilungen, Vergleichsbereiche
                          und Datenabdeckung.
                        </p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => setView("data")}
                      >
                        Originaldaten ansehen
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="profiles-grid">
                      {exploration.profiles.map((profile) => (
                        <ProfileCard key={profile.name} profile={profile} />
                      ))}
                    </div>
                    {analysis.notices.length > 0 && (
                      <details className="analysis-notices">
                        <summary>
                          <CircleHelp size={15} />
                          Hinweise zur Verarbeitung ({analysis.notices.length})
                        </summary>
                        {analysis.notices.map((notice) => (
                          <p key={notice}>{notice}</p>
                        ))}
                      </details>
                    )}
                  </>
                )}

                {view === "insights" && (
                  <>
                    <div className="findings-banner">
                      <div>
                        <span className="eyebrow">DEIN ANALYSEBRIEFING</span>
                        <h2>
                          {exploration.insights.length} überprüfbare
                          Erkenntnisse
                        </h2>
                        <p>
                          Aus {number(exploration.count, 0)} Zeilen deiner
                          aktuellen Auswahl. Wähle ein Thema oder öffne die
                          betroffenen Daten.
                        </p>
                      </div>
                      <span className="findings-count">
                        {String(exploration.insights.length).padStart(2, "0")}
                      </span>
                    </div>
                    <InsightFeed
                      items={exploration.insights}
                      onExplore={exploreInsight}
                    />
                  </>
                )}

                {view === "trends" && (
                  <Card>
                    <div className="card-heading">
                      <div>
                        <h2>Wie entwickeln sich deine Daten?</h2>
                        <p>Wähle Zeitachse, Messwert und Zusammenfassung.</p>
                      </div>
                      <TrendingUp size={21} />
                    </div>
                    <div className="chart-controls">
                      <Field label="Zeitachse">
                        <select
                          value={config.date_column ?? ""}
                          onChange={(e) =>
                            update({ date_column: e.target.value || null })
                          }
                        >
                          <option value="">Datum wählen</option>
                          {dates.map((name) => (
                            <option key={name}>{name}</option>
                          ))}
                        </select>
                      </Field>
                      {valueSelect}
                      {aggregationSelect}
                      <Field label="Zeitraum">
                        <select
                          value={config.period}
                          onChange={(e) => update({ period: e.target.value })}
                        >
                          <option value="day">Tag</option>
                          <option value="week">Woche</option>
                          <option value="month">Monat</option>
                        </select>
                      </Field>
                    </div>
                    {exploration.trend.length ? (
                      <div className="large-chart">
                        <ResponsiveContainer width="100%" height={380}>
                          <AreaChart
                            data={exploration.trend}
                            margin={{ top: 20, right: 20, bottom: 10, left: 5 }}
                          >
                            <defs>
                              <linearGradient
                                id="trendFill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0%"
                                  stopColor="#7e9dd7"
                                  stopOpacity={0.3}
                                />
                                <stop
                                  offset="100%"
                                  stopColor="#7e9dd7"
                                  stopOpacity={0.01}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="#e8eae3" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 11 }}
                              minTickGap={45}
                              tickFormatter={(value) =>
                                new Date(
                                  `${value}T00:00:00Z`,
                                ).toLocaleDateString("de-DE", {
                                  day: "2-digit",
                                  month: "short",
                                  timeZone: "UTC",
                                })
                              }
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 11 }}
                              tickFormatter={(value) => number(value, 0)}
                              axisLine={false}
                              tickLine={false}
                              width={70}
                            />
                            <Tooltip
                              labelFormatter={(value) => String(value)}
                              formatter={(value) => [
                                number(Number(value), 2),
                                config.aggregation === "count"
                                  ? "Zeilen"
                                  : config.value_column,
                              ]}
                              contentStyle={{
                                borderRadius: 12,
                                border: "1px solid #e1e6dc",
                              }}
                            />
                            <Area
                              type="linear"
                              dataKey="value"
                              stroke="#4e77c9"
                              strokeWidth={2.5}
                              fill="url(#trendFill)"
                              connectNulls={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <Empty
                        title={
                          dates.length
                            ? "Wähle eine Zeitachse und einen Messwert."
                            : "Noch keine Datumsspalte erkannt."
                        }
                      >
                        Du kannst die Spaltenrolle unter „Analyse einstellen“
                        anpassen.
                      </Empty>
                    )}
                    <div className="method-note">
                      <CircleHelp size={15} />
                      <span>
                        {exploration.skipped_dates > 0
                          ? `${exploration.skipped_dates} Zeilen ohne gültiges Datum sind ausgelassen. `
                          : ""}
                        Angezeigt werden aggregierte Beobachtungen. Eine
                        steigende Kurve ist keine Prognose. Fehlende Messwerte
                        werden nicht als null gezählt.
                      </span>
                    </div>
                  </Card>
                )}

                {view === "groups" && (
                  <>
                    <Card>
                      <div className="card-heading">
                        <div>
                          <h2>Was unterscheidet deine Gruppen?</h2>
                          <p>
                            Vergleiche vorhandene Kategorien anhand eines
                            Messwerts.
                          </p>
                        </div>
                        <Layers3 size={21} />
                      </div>
                      <div className="chart-controls">
                        <Field label="Gruppieren nach">
                          <select
                            value={config.group_column ?? ""}
                            onChange={(e) =>
                              update({ group_column: e.target.value || null })
                            }
                          >
                            <option value="">Kategorie wählen</option>
                            {categories.map((name) => (
                              <option key={name}>{name}</option>
                            ))}
                          </select>
                        </Field>
                        {valueSelect}
                        {aggregationSelect}
                      </div>
                      {exploration.groups.length ? (
                        <>
                          <div className="large-chart">
                            <ResponsiveContainer width="100%" height={310}>
                              <BarChart
                                data={exploration.groups}
                                margin={{ left: 10, right: 25, top: 20 }}
                              >
                                <CartesianGrid
                                  vertical={false}
                                  stroke="#e8eae3"
                                />
                                <XAxis
                                  dataKey="label"
                                  tick={{ fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <YAxis
                                  tickFormatter={(value) => number(value, 0)}
                                  width={70}
                                  tick={{ fontSize: 11 }}
                                  axisLine={false}
                                  tickLine={false}
                                />
                                <Tooltip
                                  formatter={(value) => [
                                    number(Number(value), 2),
                                    config.aggregation === "count"
                                      ? "Zeilen"
                                      : config.value_column,
                                  ]}
                                  cursor={{ fill: "#f1f4ed" }}
                                />
                                <Bar
                                  dataKey="value"
                                  fill="#7e99cb"
                                  maxBarSize={80}
                                  radius={[5, 5, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="group-chips">
                            {exploration.groups
                              .filter((group) => group.label !== "(fehlend)")
                              .map((group) => (
                                <button
                                  key={group.label}
                                  className="button secondary small"
                                  onClick={() =>
                                    update({
                                      category_column: config.group_column,
                                      category_value: group.label,
                                    })
                                  }
                                >
                                  {group.label}
                                  <Badge>{group.count}</Badge>
                                  <ArrowUpRight size={13} />
                                </button>
                              ))}
                          </div>
                          {exploration.group_total > 30 && (
                            <p className="small-note">
                              Gezeigt werden die 30 häufigsten von{" "}
                              {exploration.group_total} Kategorien.
                            </p>
                          )}
                        </>
                      ) : (
                        <Empty title="Wähle eine Kategorie für deinen Vergleich.">
                          Kategorien lassen sich beim Import oder in den
                          Analyseeinstellungen festlegen.
                        </Empty>
                      )}
                    </Card>
                    <div className="section-heading">
                      <div>
                        <h2>Automatisch entdeckte Gruppen</h2>
                        <p>
                          HDBSCAN sucht ähnliche Kombinationen der ausgewählten
                          Messwerte.
                        </p>
                      </div>
                      <Badge>{analysis.cluster_count} im Gesamtdatensatz</Badge>
                    </div>
                    <div className="cluster-grid">
                      {exploration.clusters.map((cluster) => (
                        <Card key={cluster.cluster} className="cluster-card">
                          <div className="card-heading">
                            <h3>
                              <i
                                className="cluster-dot"
                                style={{
                                  background: clusterColor(cluster.cluster),
                                }}
                              />
                              {cluster.cluster < 0
                                ? "Ohne Zuordnung"
                                : `Gruppe ${cluster.cluster + 1}`}
                            </h3>
                            <Badge>{number(cluster.count, 0)} Zeilen</Badge>
                          </div>
                          {cluster.differences.map((difference) => (
                            <div
                              className="cluster-difference"
                              key={difference.feature}
                            >
                              <span>
                                {difference.feature}
                                <small>
                                  Ø {number(difference.mean, 2)} · gesamt{" "}
                                  {number(difference.baseline, 2)}
                                </small>
                              </span>
                              <span
                                className={
                                  difference.delta >= 0
                                    ? "green-text"
                                    : "warm-text"
                                }
                              >
                                {difference.delta >= 0 ? (
                                  <ArrowUpRight size={14} />
                                ) : (
                                  <ArrowDown size={14} />
                                )}
                                {number(Math.abs(difference.delta), 1)} σ
                              </span>
                            </div>
                          ))}
                          <button
                            className="text-button"
                            onClick={() => {
                              update({ cluster: cluster.cluster });
                              setView("landscape");
                            }}
                          >
                            Diese Gruppe erkunden
                            <ArrowRight size={15} />
                          </button>
                        </Card>
                      ))}
                    </div>
                    <div className="method-note">
                      <CircleHelp size={15} />
                      <span>
                        σ beschreibt den Abstand des Gruppenmittelwerts vom
                        Gesamtmittel in Standardabweichungen. Beschreibende
                        Unterschiede erklären keine Ursachen. „Ohne Zuordnung“
                        ist kein eigenes Cluster.
                      </span>
                    </div>
                  </>
                )}

                {view === "anomalies" && (
                  <>
                    <div className="anomaly-intro">
                      <span className="feature-icon sand">
                        <Activity size={25} />
                      </span>
                      <div>
                        <h2>
                          {number(exploration.anomaly_count, 0)} Zeilen
                          verdienen einen zweiten Blick.
                        </h2>
                        <p>
                          Isolation Forest sucht ungewöhnliche Kombinationen in{" "}
                          {analysis.features.length} Merkmalen. Die Markierung
                          ist ein Prüfhinweis.
                        </p>
                      </div>
                    </div>
                    <Card>
                      <div className="card-heading">
                        <div>
                          <h2>Auffällige Beispiele</h2>
                          <p>
                            Die bis zu 30 auffälligsten Zeilen deiner aktuellen
                            Auswahl.
                          </p>
                        </div>
                        <Badge tone="orange">
                          Höherer Score = ungewöhnlicher
                        </Badge>
                      </div>
                      {exploration.anomalies.length ? (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Zeile</th>
                                {analysis.features.slice(0, 2).map((name) => (
                                  <th key={name}>{name}</th>
                                ))}
                                <th>Warum auffällig?</th>
                                <th>Score</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {exploration.anomalies.map((row) => (
                                <tr key={row.id}>
                                  <td>
                                    <button
                                      className="row-link"
                                      onClick={() => setInspected(row)}
                                    >
                                      #{row.id + 1}
                                    </button>
                                  </td>
                                  {analysis.features.slice(0, 2).map((name) => (
                                    <td key={name}>
                                      {formatValue(row.values[name])}
                                    </td>
                                  ))}
                                  <td className="anomaly-reason-cell">
                                    <p>{row.explanation?.summary}</p>
                                    <button
                                      className="text-button"
                                      onClick={() => setInspected(row)}
                                    >
                                      Vergleichswerte ansehen
                                      <ArrowUpRight size={13} />
                                    </button>
                                  </td>
                                  <td>
                                    <div className="score-bar">
                                      <span
                                        style={{ width: `${row.score * 100}%` }}
                                      />
                                      <strong>{row.score.toFixed(3)}</strong>
                                    </div>
                                  </td>
                                  <td>
                                    <button
                                      className="icon-button"
                                      aria-label={`Zeile ${row.id + 1} untersuchen`}
                                      onClick={() => setInspected(row)}
                                    >
                                      <ArrowUpRight size={16} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty title="Keine auffälligen Zeilen in dieser Auswahl.">
                          Prüfe Filter oder wähle andere Modellmerkmale.
                        </Empty>
                      )}
                      <div className="method-note">
                        <CircleHelp size={15} />
                        <span>
                          Der Score ist keine Fehlerwahrscheinlichkeit. Die
                          Schwelle wird vom Verfahren festgelegt
                          (contamination=auto). Seltene, korrekte Beispiele
                          können ebenfalls auffallen.
                        </span>
                      </div>
                    </Card>
                  </>
                )}

                {view === "relations" && (
                  <Card>
                    <div className="card-heading">
                      <div>
                        <h2>Welche Messwerte hängen zusammen?</h2>
                        <p>Lineare Beziehungen, sortiert nach ihrer Stärke.</p>
                      </div>
                      <GitBranch size={21} />
                    </div>
                    {exploration.correlations.length ? (
                      <div className="correlation-list">
                        {exploration.correlations.map((item) => (
                          <div
                            className="correlation-row"
                            key={`${item.x}-${item.y}`}
                          >
                            <div>
                              <strong>{item.x}</strong>
                              <span>&</span>
                              <strong>{item.y}</strong>
                              <small>
                                {number(item.count, 0)} vollständige Wertepaare
                              </small>
                            </div>
                            <div className="correlation-track">
                              <span
                                className={item.value < 0 ? "negative" : ""}
                                style={{
                                  width: `${Math.abs(item.value) * 100}%`,
                                }}
                              />
                            </div>
                            <strong
                              className={
                                item.value < 0 ? "warm-text" : "green-text"
                              }
                            >
                              {item.value > 0 ? "+" : ""}
                              {number(item.value, 2)}
                            </strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Empty title="Noch keine berechenbaren Zusammenhänge.">
                        Du brauchst mindestens zwei veränderliche Messwerte und
                        drei Datenzeilen.
                      </Empty>
                    )}
                    <div className="method-note">
                      <CircleHelp size={15} />
                      <span>
                        Pearson-Korrelation von −1 bis +1. Fehlende Werte werden
                        paarweise ausgelassen. Ausreißer können die Werte
                        beeinflussen. Korrelation belegt keine Kausalität;
                        nichtlineare Beziehungen können unentdeckt bleiben.
                      </span>
                    </div>
                  </Card>
                )}

                {view === "landscape" && (
                  <>
                    <Card className="full-landscape">
                      <div className="card-heading">
                        <div>
                          <h2>Raum für neue Entdeckungen</h2>
                          <p>
                            Punkte anklicken oder einen Bereich auswählen, um
                            die anderen Ansichten zu filtern.
                          </p>
                        </div>
                        <Badge>{analysis.projection.toUpperCase()}</Badge>
                      </div>
                      <Landscape
                        rows={visibleRows}
                        onInspect={setInspected}
                        onSelect={(ids) => update({ row_ids: ids })}
                        selected={inspected?.id ?? null}
                      />
                      <div className="card-bottom">
                        <div className="legend">
                          {exploration.clusters.map((cluster) => (
                            <button
                              key={cluster.cluster}
                              onClick={() =>
                                update({ cluster: cluster.cluster })
                              }
                            >
                              <i
                                style={{
                                  background: clusterColor(cluster.cluster),
                                }}
                              />
                              {cluster.cluster < 0
                                ? "Ohne Zuordnung"
                                : `Gruppe ${cluster.cluster + 1}`}
                            </button>
                          ))}
                          <span>
                            <i className="ring" />
                            Auffällig
                          </span>
                        </div>
                      </div>
                    </Card>
                    <div className="method-note">
                      <CircleHelp size={15} />
                      <span>
                        {analysis.projection === "pca" &&
                        analysis.explained_variance
                          ? `Erklärte Varianz: 2D ${number(analysis.explained_variance.slice(0, 2).reduce((a, b) => a + b, 0) * 100, 1)} %, 3D ${number(analysis.explained_variance.reduce((a, b) => a + b, 0) * 100, 1)} %. `
                          : ""}
                        Die Landschaft ist eine Projektion. Sichtbare Abstände
                        und leere Bereiche belegen keine Gruppen oder
                        Datenlücken. Cluster entstehen separat im Merkmalsraum.
                        In 3D wird orthografisch dargestellt.
                      </span>
                    </div>
                  </>
                )}

                {view === "data" && (
                  <>
                    <Card>
                      <div className="card-heading">
                        <div>
                          <h2>Deine Daten, Zeile für Zeile</h2>
                          <p>
                            Originalwerte · Seite {config.page + 1} von{" "}
                            {Math.max(1, Math.ceil(selectedCount / 50))}
                          </p>
                        </div>
                        <button
                          className="button secondary small"
                          disabled={exporting}
                          onClick={() => void exportCsv()}
                        >
                          <ArrowDownToLine size={15} />
                          Auswahl exportieren
                        </button>
                      </div>
                      {exploration.rows.length ? (
                        <div className="table-scroll">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Zeile</th>
                                <th>Status</th>
                                {Object.keys(analysis.roles).map((name) => (
                                  <th key={name}>{name}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {exploration.rows.map((row) => (
                                <tr
                                  key={row.id}
                                  className={
                                    inspected?.id === row.id
                                      ? "selected-row"
                                      : ""
                                  }
                                >
                                  <td>
                                    <button
                                      className="row-link"
                                      onClick={() => setInspected(row)}
                                    >
                                      #{row.id + 1}
                                    </button>
                                  </td>
                                  <td>
                                    {row.anomaly ? (
                                      <Badge tone="orange">Auffällig</Badge>
                                    ) : (
                                      <span className="normal-status">
                                        Unmarkiert
                                      </span>
                                    )}
                                  </td>
                                  {Object.keys(analysis.roles).map((name) => (
                                    <td
                                      key={name}
                                      title={String(row.values[name] ?? "")}
                                    >
                                      {formatValue(row.values[name])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <Empty title="Keine Zeilen in dieser Auswahl.">
                          Setze einen Filter zurück, um mehr Daten zu sehen.
                        </Empty>
                      )}
                      <div className="pagination">
                        <span>
                          {number(selectedCount, 0)} Zeilen in deiner Auswahl
                        </span>
                        <div>
                          <button
                            className="icon-button"
                            aria-label="Vorherige Seite"
                            disabled={config.page === 0}
                            onClick={() => update({ page: config.page - 1 })}
                          >
                            <ChevronLeft size={18} />
                          </button>
                          <span>{config.page + 1}</span>
                          <button
                            className="icon-button"
                            aria-label="Nächste Seite"
                            disabled={(config.page + 1) * 50 >= selectedCount}
                            onClick={() => update({ page: config.page + 1 })}
                          >
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  </>
                )}

                {view === "overview" && numeric.length > 0 && (
                  <Card className="distribution-card">
                    <div className="card-heading">
                      <div>
                        <h2>Wie verteilen sich die Werte?</h2>
                        <p>Eine andere Perspektive auf einzelne Messwerte.</p>
                      </div>
                      <select
                        aria-label="Verteilung für Messwert"
                        value={chartFeature}
                        onChange={(e) => setChartFeature(e.target.value)}
                      >
                        {numeric.map((name) => (
                          <option key={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                    {featureProfile && (
                      <div className="large-chart">
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={featureProfile.distribution}>
                            <CartesianGrid vertical={false} stroke="#e8eae3" />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 10 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 10 }}
                              width={40}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              formatter={(value) => [
                                number(Number(value), 0),
                                "Zeilen",
                              ]}
                              labelFormatter={(value) =>
                                `${featureProfile.distribution_kind === "discrete" ? "Messwert" : "Wertebereich"}: ${value}`
                              }
                            />
                            <Bar
                              dataKey="count"
                              fill="#6e8bd1"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>
                )}
                <footer className="workspace-footer">
                  <span>
                    <ShieldCheck size={13} />
                    Lokal analysiert · {analysis.features.length} Modellmerkmale
                    · Seed {analysis.seed}
                  </span>
                  <button
                    className="text-button"
                    onClick={() =>
                      download(
                        new Blob(
                          [
                            JSON.stringify(
                              {
                                dataset_id: analysis.dataset_id,
                                dataset: analysis.name,
                                config: analysis.config,
                                projection: analysis.projection,
                                versions: analysis.versions,
                                seed: analysis.seed,
                                view,
                                filters: config,
                              },
                              null,
                              2,
                            ),
                          ],
                          { type: "application/json" },
                        ),
                        "latentspace-analyse.json",
                      )
                    }
                  >
                    <Settings2 size={13} />
                    Analysekonfiguration exportieren
                  </button>
                </footer>
              </div>
            )}
          </div>
        )}
      </main>

      {inspected && analysis && (
        <aside className="inspector">
          <div className="inspector-heading">
            <span className="eyebrow">DATEN UNTER DER LUPE</span>
            <button
              className="icon-button"
              aria-label="Detailansicht schließen"
              onClick={() => setInspected(null)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="inspector-title">
            <span className="feature-icon sage">
              <MousePointerIcon />
            </span>
            <h2>Zeile #{inspected.id + 1}</h2>
            <Badge tone={inspected.anomaly ? "orange" : "green"}>
              {inspected.anomaly ? "Auffällig" : "Unmarkiert"}
            </Badge>
          </div>
          <div className="inspector-meta">
            <span>
              Cluster
              <strong>
                {inspected.cluster < 0
                  ? "Ohne Zuordnung"
                  : `Gruppe ${inspected.cluster + 1}`}
              </strong>
            </span>
            <span>
              Anomaliescore<strong>{inspected.score.toFixed(3)}</strong>
            </span>
          </div>
          {job && (
            <ExplanationPanel
              key={`${job}-${inspected.id}`}
              job={job}
              row={inspected}
            />
          )}
          <h3>Ursprüngliche Werte</h3>
          <dl>
            {Object.entries(inspected.values).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {key}
                  <small>{roleLabels[analysis.roles[key]]}</small>
                </dt>
                <dd>{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
          <button
            className="button secondary"
            onClick={() => {
              update({ row_ids: [inspected.id] });
              setView("data");
            }}
          >
            Nur diese Zeile anzeigen
            <ArrowRight size={15} />
          </button>
          <p className="small-note">
            Der Anomaliescore beschreibt die Auffälligkeit im gesamten Datensatz
            und ist keine Fehlerwahrscheinlichkeit.
          </p>
        </aside>
      )}

      {showImport && (
        <div className="modal-backdrop">
          <section
            className="modal import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">NEUE DATEN, NEUE FRAGEN</span>
                <h2 id="import-title">Was möchtest du entdecken?</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Import schließen"
                disabled={busy}
                onClick={() => setShowImport(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-content">
              {error && (
                <p className="error-inline" role="alert">
                  {error}
                </p>
              )}
              <Field label="Dezimaltrennzeichen in Textwerten">
                <select
                  value={decimal}
                  onChange={(e) => setDecimal(e.target.value)}
                >
                  <option value=".">Punkt · 1234.56</option>
                  <option value=",">Komma · 1.234,56</option>
                </select>
              </Field>
              <button
                className="dropzone"
                disabled={busy}
                onClick={() => uploadInput.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void upload(e.dataTransfer.files[0]);
                }}
              >
                <span className="upload-circle">
                  <Upload size={27} />
                </span>
                <strong>Datei hier ablegen</strong>
                <span>oder klicken, um eine Datei auszuwählen</span>
                <small>
                  CSV oder XLSX · max. 20 MB · 20.000 Zeilen · 80 Spalten
                </small>
              </button>
              <input
                ref={uploadInput}
                type="file"
                accept=".csv,.xlsx"
                className="visually-hidden"
                aria-label="Datendatei auswählen"
                onChange={(e) => void upload(e.target.files?.[0])}
              />
              <div className="import-details">
                <FileSpreadsheet size={17} />
                <p>
                  Die erste Zeile enthält Spaltennamen. Bei Excel wird das erste
                  Tabellenblatt gelesen. Anschließend kannst du die erkannten
                  Spaltenrollen prüfen.
                </p>
              </div>
              <div className="import-demo">
                <span>Noch keine Datei zur Hand?</span>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => void loadDemo()}
                >
                  Beispieldaten ausprobieren
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
      {pending && (
        <ConfigDialog
          key={pending.id}
          dataset={pending}
          initial={settingsSameDataset ? analysis?.config : undefined}
          busy={busy}
          onClose={closeConfig}
          onRun={(options) => void run(pending, options)}
        />
      )}
    </div>
  );
}

function MousePointerIcon() {
  return <Search size={24} />;
}
