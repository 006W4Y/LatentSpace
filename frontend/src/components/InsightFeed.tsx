import {
  Activity,
  ArrowUpRight,
  CircleHelp,
  GitBranch,
  Layers3,
  ScanSearch,
  TrendingUp,
} from "lucide-react";
import type { Insight, ExploreConfig } from "../api";
import { number } from "../api";
import FindingBasis from "./FindingBasis";

const families = {
  anomaly: {
    label: "Wertabweichung",
    filter: "Auffälligkeiten",
    icon: Activity,
  },
  trend: { label: "Zeitlicher Vergleich", filter: "Zeit", icon: TrendingUp },
  group: { label: "Gruppenvergleich", filter: "Gruppen", icon: Layers3 },
  relation: { label: "Zusammenhang", filter: "Zusammenhänge", icon: GitBranch },
  quality: {
    label: "Datenabdeckung",
    filter: "Datenabdeckung",
    icon: ScanSearch,
  },
};

export default function InsightFeed({
  items,
  onExplore,
  compact = false,
  filter = "all",
  counts,
  onFilter,
}: {
  items: Insight[];
  onExplore: (item: Insight) => void;
  compact?: boolean;
  filter?: ExploreConfig["finding_kind"];
  counts?: Partial<Record<Insight["kind"], number>>;
  onFilter?: (kind: ExploreConfig["finding_kind"]) => void;
}) {
  const visible = items;
  return (
    <div className="insight-feed">
      {!compact && (
        <div
          className="insight-family-filters"
          aria-label="Insights nach Thema filtern"
        >
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => onFilter?.("all")}
          >
            Alle Befunde{" "}
            <span>
              {counts
                ? Object.values(counts).reduce(
                    (sum, value) => sum + (value ?? 0),
                    0,
                  )
                : items.length}
            </span>
          </button>
          {Object.entries(families).map(([key, family]) => {
            const count =
              counts?.[key as Insight["kind"]] ??
              items.filter((item) => item.kind === key).length;
            return count ? (
              <button
                key={key}
                className={filter === key ? "active" : ""}
                onClick={() => onFilter?.(key as Insight["kind"])}
              >
                <family.icon size={14} />
                {family.filter}
                <span>{count}</span>
              </button>
            ) : null;
          })}
        </div>
      )}
      <div className={`discovery-grid ${compact ? "compact-feed" : ""}`}>
        {visible.map((item) => {
          const family = families[item.kind];
          return (
            <article
              key={item.token}
              className={`discovery-card discovery-${item.kind}`}
            >
              <div className="discovery-top">
                <span className="discovery-family">
                  <family.icon size={14} />
                  {family.label}
                </span>
                <span className="discovery-sample">
                  n = {number(item.sample_size, 0)}
                </span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <FindingBasis finding={item} compact />
              <div className="finding-measures">
                {Object.entries(item.metrics).map(
                  ([key, metric]) =>
                    metric && (
                      <span key={key} title={metric.label}>
                        {metric.label}:{" "}
                        <strong>
                          {number(
                            key === "coverage"
                              ? metric.value * 100
                              : metric.value,
                            key === "sample_size" ? 0 : 3,
                          )}
                          {key === "coverage" ? " %" : ""}
                        </strong>
                      </span>
                    ),
                )}
              </div>
              <div className="discovery-evidence">
                {item.evidence.map((entry, i) => (
                  <div key={`${entry.label}-${i}`}>
                    <span>{entry.label}</span>
                    <strong>{entry.value}</strong>
                  </div>
                ))}
              </div>
              <div className="discovery-footer">
                <span>Aktuelle Auswahl</span>
                <button className="text-button" onClick={() => onExplore(item)}>
                  Befund untersuchen
                  <ArrowUpRight size={15} />
                </button>
              </div>
              <details className="discovery-method">
                <summary>
                  <CircleHelp size={12} />
                  Wie wurde das ermittelt?
                </summary>
                <p>{item.method}</p>
                <p>{item.limitation}</p>
              </details>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <div className="insight-empty">
          <ScanSearch size={26} />
          <h3>Keine automatischen Befunde für diese Auswahl.</h3>
          <p>
            Für diese Kombination aus Zeilen-, Themen- und Verfahrensfilter
            liegt kein Befund nach den verwendeten Suchregeln vor.
          </p>
        </div>
      )}
    </div>
  );
}
