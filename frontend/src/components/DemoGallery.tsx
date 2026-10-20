import {
  ArrowUpRight,
  Building2,
  GraduationCap,
  ShoppingBag,
} from "lucide-react";
import type { Demo } from "../api";
import { number } from "../api";

const icons = {
  retail: ShoppingBag,
  energy: Building2,
  learning: GraduationCap,
};

export default function DemoGallery({
  demos,
  busy,
  onSelect,
  compact = false,
}: {
  demos: Demo[];
  busy: boolean;
  onSelect: (kind: Demo["id"]) => void;
  compact?: boolean;
}) {
  if (!demos.length) return null;
  return (
    <section
      className={`demo-gallery${compact ? " compact" : ""}`}
      aria-label="Beispieldatensätze"
    >
      <div className="section-heading">
        <div>
          <h2>Drei Kontexte. Viele Perspektiven.</h2>
          <p>
            Wähle ein Beispiel. Jede Analyse untersucht einen einzelnen
            Datensatz.
          </p>
        </div>
        <span className="demo-synthetic">Synthetische Daten</span>
      </div>
      <div className="demo-grid">
        {demos.map((demo) => {
          const Icon = icons[demo.id];
          return (
            <article className={`demo-card demo-${demo.id}`} key={demo.id}>
              <div className="demo-card-heading">
                <span className="demo-icon">
                  <Icon size={21} />
                </span>
                <span>{number(demo.row_count, 0)} Zeilen</span>
              </div>
              <h3>{demo.title}</h3>
              <p>{demo.description}</p>
              <small>{demo.grain}</small>
              <ul aria-label="Dateneigenschaften">
                {demo.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => onSelect(demo.id)}
              >
                {demo.title} erkunden <ArrowUpRight size={16} />
              </button>
            </article>
          );
        })}
      </div>
      <p className="demo-footnote">
        Die Beispiele enthalten bewusst Muster, Auffälligkeiten und fehlende
        Werte. Die Originalwerte bleiben erhalten.
      </p>
    </section>
  );
}
