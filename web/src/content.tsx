import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getContent, type ContentPackage } from "./api";
import { load, save } from "./storage";

const storageKey = "content-package";

interface ContentState {
  // undefined while loading, null when it couldn't be loaded at all.
  content: ContentPackage | null | undefined;
}

const ContentContext = createContext<ContentState>({ content: undefined });

// Provides the content package: the stored copy at once, then the server's copy
// when it's reachable and newer. Offline, the stored copy is used.
export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ContentPackage | null | undefined>(() => load<ContentPackage>(storageKey));
  useEffect(() => {
    getContent().then(
      (fresh) => {
        setContent((old) => (old?.version === fresh.version ? old : fresh));
        save(storageKey, fresh);
      },
      () => setContent((old) => old ?? null),
    );
  }, []);
  return <ContentContext.Provider value={{ content }}>{children}</ContentContext.Provider>;
}

export const useContent = () => useContext(ContentContext).content;
