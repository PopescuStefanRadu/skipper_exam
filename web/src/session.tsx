import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, getProfile, type Me, type Profile } from "./api";
import { load, remove, save } from "./storage";

interface Session {
  // undefined while loading, null when signed out.
  me: Me | null | undefined;
  profile: Profile | null;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<Session>({ me: undefined, profile: null, refresh: async () => {} });

// The signed-in account and its profile are kept on the device, so the app starts
// signed in without a connection. The server's answer comes first, though: the stored
// copy is used only when the server can't be reached, since the profile may have
// changed elsewhere. Only the server saying "signed out" ends the stored session.
const meKey = "session-me";
const profileKey = "session-profile";

// Profiles stored by earlier versions had a single exam type.
function storedProfile(): Profile | null {
  const p = load<Profile & { examType?: string }>(profileKey);
  if (!p) return null;
  if (Array.isArray(p.examTypes)) return p;
  return { examTypes: p.examType ? [p.examType] : [] };
}

export function forgetSession() {
  remove(meKey);
  remove(profileKey);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const refresh = useCallback(async () => {
    let signedIn: Me | null;
    try {
      signedIn = await getMe();
    } catch {
      // Offline or the server is unavailable: keep what the device knows.
      const known = load<Me>(meKey) ?? null;
      setProfile(known ? storedProfile() : null);
      setMe(known);
      return;
    }
    if (!signedIn) {
      forgetSession();
      setProfile(null);
      setMe(null);
      return;
    }
    let p: Profile | null = null;
    try {
      p = await getProfile();
      save(profileKey, p);
    } catch {
      p = storedProfile();
    }
    save(meKey, signedIn);
    setProfile(p);
    setMe(signedIn);
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <SessionContext.Provider value={{ me, profile, refresh }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
