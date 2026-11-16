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
  // Records an event on the device and syncs it.
  record: (type: string, data: Record<string, unknown>, at?: Date) => AppEvent;
}

const EventsContext = createContext<EventsState>({
  events: [],
  record: () => {
    throw new Error("no EventsProvider");
  },
});

function merge(a: AppEvent[], b: AppEvent[]): AppEvent[] {
  const byId = new Map(a.map((e) => [e.id, e]));
  for (const e of b) if (!byId.has(e.id)) byId.set(e.id, e);
  // Array.sort is stable, so events with the same time keep the order they were recorded in.
  return [...byId.values()].sort((x, y) => x.at.localeCompare(y.at));
}

// Keeps the signed-in user's events: on the device first, then synced with the
// server, so nothing is lost offline and other devices' events show up here.
export function EventsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const key = `events:${userId}`;
  const log = useRef<Log>(load<Log>(key) ?? { events: [], pending: [] });
  const [events, setEvents] = useState(log.current.events);
  const syncing = useRef<Promise<void>>(Promise.resolve());

  const update = useCallback(
    (next: Log) => {
      log.current = next;
      save(key, next);
      setEvents(next.events);
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
    return () => window.removeEventListener("online", onOnline);
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

  return <EventsContext.Provider value={{ events, record }}>{children}</EventsContext.Provider>;
}

export const useEvents = () => useContext(EventsContext);
