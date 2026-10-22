import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import type { ResearchRecord } from "../api";
export default function useResearch(
  dataset: string | undefined,
  onError: (message: string) => void,
) {
  const [state, setState] = useState<{
    dataset: string;
    records: ResearchRecord[];
  } | null>(null);
  const refresh = useCallback(async () => {
    if (!dataset) return;
    try {
      const records = await api<ResearchRecord[]>(
        `/datasets/${dataset}/research`,
      );
      setState({ dataset, records });
    } catch (error) {
      onError((error as Error).message);
    }
  }, [dataset, onError]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return {
    records: state && state.dataset === dataset ? state.records : [],
    refresh,
  };
}
