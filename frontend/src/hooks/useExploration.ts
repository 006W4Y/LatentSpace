import { useCallback, useEffect, useState } from "react";
import { post } from "../api";
import type { Exploration, ExploreConfig } from "../api";
export default function useExploration(
  job: string | null,
  config: ExploreConfig,
  explainPage: boolean,
  onError: (message: string) => void,
) {
  const [state, setState] = useState<{ job: string; data: Exploration } | null>(
    null,
  );
  const [exploring, setExploring] = useState(false);
  const clearExploration = useCallback(() => setState(null), []);
  useEffect(() => {
    if (!job) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => {
      setExploring(true);
      post<Exploration>(
        `/analyses/${job}/explore`,
        { ...config, explain_page: explainPage },
        controller.signal,
      )
        .then((data) => {
          if (active) {
            setState({ job, data });
            setExploring(false);
          }
        })
        .catch((error) => {
          if (active && error.name !== "AbortError") {
            onError(error.message);
            setExploring(false);
          }
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [job, config, explainPage, onError]);
  return {
    exploration: state?.job === job ? state.data : null,
    exploring,
    clearExploration,
  };
}
