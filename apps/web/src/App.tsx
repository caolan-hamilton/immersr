import { useEffect, useState } from "react";
import { HealthResponse } from "@immersr/shared";

type State = { kind: "loading" } | { kind: "ok"; health: HealthResponse } | { kind: "error"; message: string };

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    fetch("/api/health")
      .then(async (r) => {
        if (!r.ok) throw new Error(`API returned ${r.status}`);
        setState({ kind: "ok", health: HealthResponse.parse(await r.json()) });
      })
      .catch((err: unknown) => setState({ kind: "error", message: err instanceof Error ? err.message : String(err) }));
  }, []);

  return (
    <main>
      <h1>Immersr</h1>
      <p className="muted">Live conversation in the language you're acquiring.</p>
      <section aria-live="polite">
        {state.kind === "loading" && <p>Checking the API…</p>}
        {state.kind === "ok" && (
          <p>
            <span className="dot ok" /> API healthy on <b>{state.health.stage}</b>, database reachable, at{" "}
            {new Date(state.health.time).toLocaleTimeString()}.
          </p>
        )}
        {state.kind === "error" && (
          <p>
            <span className="dot bad" /> API unreachable: {state.message}
          </p>
        )}
      </section>
    </main>
  );
}
