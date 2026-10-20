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
      <Account />
    </>
  );
}

// The Account screen: sign out, or erase everything (GDPR) after an explicit confirmation.
function Account() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>();

  async function deleteAccount() {
    setDeleting(true);
    setError(undefined);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("You're signed out. Sign in again to delete your account.");
      const response = await fetch("/api/me", { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`Something went wrong (${response.status}). Please try again.`);
      await signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDeleting(false);
    }
  }

  return (
    <>
      <h2>Account</h2>
      <p>
        <button onClick={() => void signOut()}>Sign out</button>
      </p>
      {!confirming ? (
        <p>
          <button onClick={() => setConfirming(true)}>Delete my account</button>
        </p>
      ) : (
        <div role="alertdialog" aria-labelledby="delete-title">
          <h3 id="delete-title">Delete your account?</h3>
          <p>This permanently removes your account, your Immersion time in every language, your Session history and your
            usage records. It can't be undone. If a Session is in progress, it ends first.</p>
          <p className="muted">
            Session audio is processed by OpenAI while you talk; we don't store Transcripts, so there is nothing of
            that to delete here.
          </p>
          <p>
            <button onClick={() => void deleteAccount()} disabled={deleting}>
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </button>{" "}
            <button onClick={() => setConfirming(false)} disabled={deleting}>
              Cancel
            </button>
          </p>
          {error && (
            <p>
              <span className="dot bad" /> {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
