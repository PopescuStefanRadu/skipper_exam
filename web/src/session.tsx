import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, type Me } from "./api";

interface Session {
  // undefined while loading, null when signed out.
  me: Me | null | undefined;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<Session>({ me: undefined, refresh: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const refresh = useCallback(async () => {
    try {
      setMe(await getMe());
    } catch {
      setMe(null);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <SessionContext.Provider value={{ me, refresh }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
