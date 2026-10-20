import { useEffect, useState } from "react";
import { api } from "./api";
import type { DataRow, RowExplanation } from "./api";

export default function useRowExplanation(
  job: string | null,
  row: DataRow | null,
) {
  const key = job && row ? `${job}:${row.id}` : null;
  const [state, setState] = useState<{
    key: string;
    explanation: RowExplanation | null;
    error: string;
  } | null>(null);
  const embedded = row?.explanation;
  const id = row?.id;
  useEffect(() => {
    if (!key || !job || id === undefined || embedded) return;
    const controller = new AbortController();
    api<RowExplanation>(`/analyses/${job}/rows/${id}/explanation`, {
      signal: controller.signal,
    })
      .then((explanation) => setState({ key, explanation, error: "" }))
      .catch((error) => {
        if (error.name !== "AbortError")
          setState({ key, explanation: null, error: error.message });
      });
    return () => controller.abort();
  }, [key, job, id, embedded]);
  return {
    explanation: embedded ?? (state?.key === key ? state.explanation : null),
    error: !embedded && state?.key === key ? state.error : "",
  };
}
