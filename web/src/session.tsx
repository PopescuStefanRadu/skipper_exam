import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, getProfile, type Me, type Profile } from "./api";

interface Session {
  // undefined while loading, null when signed out.
  me: Me | null | undefined;
  profile: Profile | null;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<Session>({ me: undefined, profile: null, refresh: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const refresh = useCallback(async () => {
    try {
      const signedIn = await getMe();
      setProfile(signedIn ? await getProfile() : null);
      setMe(signedIn);
    } catch {
      setProfile(null);
      setMe(null);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <SessionContext.Provider value={{ me, profile, refresh }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
