import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CircleHelp,
  GitBranch,
  Layers3,
  ScanSearch,
  TrendingUp,
} from "lucide-react";
import type { Insight } from "../api";
import { number } from "../api";

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

export function variedInsights(items: Insight[], limit = 6) {
  const chosen: Insight[] = [];
  for (const item of items)
    if (!chosen.some((x) => x.kind === item.kind)) chosen.push(item);
  for (const item of items)
    if (chosen.length < limit && !chosen.includes(item)) chosen.push(item);
  return chosen.slice(0, limit);
}

export default function InsightFeed({
  items,
  onExplore,
  compact = false,
}: {
  items: Insight[];
  onExplore: (item: Insight) => void;
  compact?: boolean;
}) {
  const [filter, setFilter] = useState("all");
  const visible =
    compact || filter === "all"
      ? items
      : items.filter((item) => item.kind === filter);
  return (
    <div className="insight-feed">
      {!compact && (
        <div
          className="insight-family-filters"
          aria-label="Insights nach Thema filtern"
        >
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            Alle Erkenntnisse <span>{items.length}</span>
          </button>
          {Object.entries(families).map(([key, family]) => {
            const count = items.filter((item) => item.kind === key).length;
            return count ? (
              <button
                key={key}
                className={filter === key ? "active" : ""}
                onClick={() => setFilter(key)}
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
              key={item.id}
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
            Ein fehlender Hinweis bedeutet nicht, dass es keine Struktur gibt.
            Prüfe eine größere Auswahl oder andere Merkmale.
          </p>
        </div>
      )}
    </div>
  );
}
