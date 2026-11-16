import { useEffect, useState } from "react";
import { strings } from "./strings";

type ServerState = "checking" | "ok" | "unavailable";

export function App() {
  const [server, setServer] = useState<ServerState>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { status: string }) => !cancelled && setServer(body.status === "ok" ? "ok" : "unavailable"))
      .catch(() => !cancelled && setServer("unavailable"));
    return () => {
      cancelled = true;
    };
  }, []);

  const label = { checking: strings.serverChecking, ok: strings.serverOk, unavailable: strings.serverUnavailable }[server];

  return (
    <main>
      <h1>{strings.appTitle}</h1>
      <p>{strings.appSubtitle}</p>
      <p>
        {strings.serverStatus}: <span data-testid="server-status" data-state={server}>{label}</span>
      </p>
    </main>
  );
}
