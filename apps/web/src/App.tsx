import { useEffect, useState } from "react";
import { MeResponse } from "@immersr/shared";
import { formatDuration, formatTimeOfDay, languageName } from "./format.ts";
import { SessionPanel } from "./SessionPanel.tsx";
import { completeSignInIfRedirected, getIdToken, isSignedIn, signIn, signOut } from "./auth.ts";

type State =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "home"; me: MeResponse }
  | { kind: "error"; message: string };

async function loadMe(): Promise<State> {
  const token = await getIdToken();
  if (!token) return { kind: "signed-out" };
  const response = await fetch("/api/me", { headers: { authorization: `Bearer ${token}` } });
  if (response.status === 401) return { kind: "signed-out" };
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return { kind: "home", me: MeResponse.parse(await response.json()) };
}

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });
  // Refresh the totals after a Session settles, without flashing the loading state.
  const refreshMe = () => void loadMe().then(setState, () => undefined);

  useEffect(() => {
    completeSignInIfRedirected()
      .then(() => (isSignedIn() ? loadMe() : { kind: "signed-out" as const }))
      .then(setState)
      .catch((err: unknown) => setState({ kind: "error", message: err instanceof Error ? err.message : String(err) }));
  }, []);

  return (
    <main>
      <h1>Immersr</h1>
      <p className="muted">Live conversation in the language you're acquiring.</p>
      <section aria-live="polite">
        {state.kind === "loading" && <p>Loading…</p>}
        {state.kind === "signed-out" && (
          <button onClick={() => void signIn()}>Sign in with Google</button>
        )}
        {state.kind === "error" && (
          <p>
            <span className="dot bad" /> Something went wrong: {state.message}
          </p>
        )}
        {state.kind === "home" && <Home me={state.me} onSessionSettled={refreshMe} />}
      </section>
    </main>
  );
}

function Home({ me, onSessionSettled }: { me: MeResponse; onSessionSettled(): void }) {
  const { allowance, immersion } = me;
  const remaining = Math.max(0, allowance.limitSeconds - allowance.usedSeconds);
  const languages = Object.entries(immersion);
  return (
    <>
      <h2>Today</h2>
      <p>
        <b>{formatDuration(remaining)}</b> of your daily allowance left. It resets at{" "}
        {formatTimeOfDay(allowance.resetsAt)}.
      </p>
      <h2>Immersion time</h2>
      {languages.length === 0 ? (
        <p className="muted">None yet. Your listening time will build up here.</p>
      ) : (
        <ul>
          {languages.map(([language, seconds]) => (
            <li key={language}>
              {languageName(language)}: <b>{formatDuration(seconds)}</b>
            </li>
          ))}
        </ul>
      )}
      <SessionPanel allowance={allowance} onSettled={onSessionSettled} />
      <p>
        <button onClick={() => void signOut()}>Sign out</button>
      </p>
    </>
  );
}
