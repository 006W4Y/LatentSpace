import { useState } from "react";
import {
  ArrowDownToLine,
  ChevronDown,
  FileJson,
  FileText,
  LoaderCircle,
} from "lucide-react";
import type { ExploreConfig } from "../api";
import { download, localFetch } from "../api";

export default function ReportActions({
  job,
  config,
  onError,
}: {
  job: string;
  config: ExploreConfig;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function exportReport(format: "markdown" | "json") {
    setBusy(true);
    try {
      const response = await localFetch(
        `/api/analyses/${job}/report?format=${format}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          result.detail || "Bericht konnte nicht erstellt werden.",
        );
      }
      download(
        await response.blob(),
        format === "markdown"
          ? "latentspace-insights.md"
          : "latentspace-insights.json",
      );
    } catch (error) {
      onError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="report-menu">
      <summary className="button primary small">
        {busy ? (
          <LoaderCircle className="spin" size={15} />
        ) : (
          <ArrowDownToLine size={15} />
        )}
        Bericht exportieren
        <ChevronDown size={12} />
      </summary>
      <div className="report-options">
        <strong>Erkenntnisse weitergeben</strong>
        <p>
          Exportiert die aktuelle Befundseite mit Vergleichswerten, Verfahren,
          Filtern und Gesamtzählung.
        </p>
        <button disabled={busy} onClick={() => void exportReport("markdown")}>
          <FileText size={17} />
          <span>
            Lesbarer Analysebericht<small>Markdown · für die Übergabe</small>
          </span>
        </button>
        <button disabled={busy} onClick={() => void exportReport("json")}>
          <FileJson size={17} />
          <span>
            Angezeigte Befunde<small>JSON · für die Weiteranalyse</small>
          </span>
        </button>
      </div>
    </details>
  );
}
