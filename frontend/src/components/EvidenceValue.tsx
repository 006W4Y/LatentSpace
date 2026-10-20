import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Comparison } from "../api";
import { number } from "../api";

export function evidenceDescription(reason: Comparison) {
  return `${reason.feature}: ${reason.detail} ${reason.criterion ?? ""} Vergleich: ${reason.kind === "context" ? "ähnliche Zeilen" : "übrige Gesamtdaten"}, n=${reason.reference_n}.`;
}

export default function EvidenceValue({
  reason,
  children,
  onInspect,
}: {
  reason: Comparison;
  children: ReactNode;
  onInspect?: () => void;
}) {
  const content = (
    <>
      <span className="evidence-observed">
        {children}
        {reason.direction === "höher" ? (
          <ArrowUp size={13} />
        ) : (
          <ArrowDown size={13} />
        )}
      </span>
      <span className="evidence-direction">
        {reason.direction === "höher" ? "Erhöht" : "Verringert"}
        {reason.kind === "context"
          ? " bei ähnlichen Zeilen"
          : " im Gesamtvergleich"}
      </span>
      <span className="evidence-median">Median {number(reason.median, 2)}</span>
    </>
  );
  return onInspect ? (
    <button
      type="button"
      className="evidence-value"
      title={evidenceDescription(reason)}
      aria-label={`Auffälliger Wert: ${evidenceDescription(reason)} Vergleichswerte anzeigen`}
      onClick={onInspect}
    >
      {content}
    </button>
  ) : (
    <span className="evidence-value" title={evidenceDescription(reason)}>
      {content}
    </span>
  );
}
