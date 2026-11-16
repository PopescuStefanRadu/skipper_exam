import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getExplanations, type Explanation } from "./api";
import { load, save } from "./storage";

const storageKey = "explanations";

interface ExplanationsState {
  // undefined while loading with nothing stored.
  explanations: Explanation[] | undefined;
  // Replaces one explanation, e.g. after a review.
  update: (e: Explanation) => void;
}

const ExplanationsContext = createContext<ExplanationsState>({ explanations: undefined, update: () => {} });

// Provides the explanations: the stored copy at once, then the server's when it's
// reachable, so explanations work offline.
export function ExplanationsProvider({ children }: { children: ReactNode }) {
  const [explanations, setExplanations] = useState<Explanation[] | undefined>(() => load<Explanation[]>(storageKey));
  useEffect(() => {
    getExplanations().then(
      (fresh) => {
        setExplanations(fresh);
        save(storageKey, fresh);
      },
      () => setExplanations((old) => old ?? []),
    );
  }, []);
  const update = useCallback((e: Explanation) => {
    setExplanations((old) => {
      const rest = (old ?? []).filter((x) => x.questionId !== e.questionId);
      const next = [...rest, e];
      save(storageKey, next);
      return next;
    });
  }, []);
  return <ExplanationsContext.Provider value={{ explanations, update }}>{children}</ExplanationsContext.Provider>;
}

export const useExplanations = () => useContext(ExplanationsContext);
