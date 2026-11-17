import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getEvents, postEvents, type AppEvent } from "./api";
import { load, save, uuid } from "./storage";

interface Log {
  events: AppEvent[];
  // IDs of events not yet stored on the server.
  pending: string[];
}

interface EventsState {
  events: AppEvent[];
  // How many events are on the device only, waiting to be sent to the server.
  pending: number;
  // Records an event on the device and syncs it.
  record: (type: string, data: Record<string, unknown>, at?: Date) => AppEvent;
}

const EventsContext = createContext<EventsState>({
  events: [],
  pending: 0,
  record: () => {
    throw new Error("no EventsProvider");
  },
});

const retryMs = 15_000;

function merge(a: AppEvent[], b: AppEvent[]): AppEvent[] {
  const byId = new Map(a.map((e) => [e.id, e]));
  for (const e of b) if (!byId.has(e.id)) byId.set(e.id, e);
  // Compare times, not texts: the server writes them in a shorter form (no trailing
  // zeros), so "…:45Z" and "…:45.700Z" would sort the wrong way round as text.
  // Array.sort is stable, so events with the same time keep the order they were recorded in.
  return [...byId.values()].sort((x, y) => Date.parse(x.at) - Date.parse(y.at));
}

// Keeps the signed-in user's events: on the device first, then synced with the
// server, so nothing is lost offline and other devices' events show up here.
export function EventsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const key = `events:${userId}`;
  const log = useRef<Log>(load<Log>(key) ?? { events: [], pending: [] });
  const [events, setEvents] = useState(log.current.events);
  const [pending, setPending] = useState(log.current.pending.length);
  const syncing = useRef<Promise<void>>(Promise.resolve());

  const update = useCallback(
    (next: Log) => {
      log.current = next;
      save(key, next);
      setEvents(next.events);
      setPending(next.pending.length);
    },
    [key],
  );

  const sync = useCallback(() => {
    syncing.current = syncing.current.then(async () => {
      try {
        const sent = log.current.pending;
        if (sent.length > 0) {
          await postEvents(log.current.events.filter((e) => sent.includes(e.id)));
        }
        const remote = await getEvents();
        const pending = log.current.pending.filter((id) => !sent.includes(id));
        update({ events: merge(log.current.events, remote), pending });
      } catch {
        // Offline or the server is unavailable: try again on the next event or start.
      }
    });
    return syncing.current;
  }, [update]);

  useEffect(() => {
    void sync();
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    // The browser only reports a lost connection, not a server that's back, so
    // waiting events are retried regularly too.
    const retry = setInterval(() => {
      if (log.current.pending.length > 0) void sync();
    }, retryMs);
    return () => {
      window.removeEventListener("online", onOnline);
      clearInterval(retry);
    };
  }, [sync]);

  const record = useCallback(
    (type: string, data: Record<string, unknown>, at = new Date()) => {
      const e: AppEvent = { id: uuid(), type, at: at.toISOString(), data };
      update({ events: merge(log.current.events, [e]), pending: [...log.current.pending, e.id] });
      void sync();
      return e;
    },
    [update, sync],
  );

  return <EventsContext.Provider value={{ events, pending, record }}>{children}</EventsContext.Provider>;
}

export const useEvents = () => useContext(EventsContext);
