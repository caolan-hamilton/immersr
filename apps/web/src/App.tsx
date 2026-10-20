import { useEffect, useState, type ReactNode } from "react";
import { MeResponse } from "@immersr/shared";
import { Account } from "./Account.tsx";
import { Blob } from "./Blob.tsx";
import { Home } from "./Home.tsx";
import { Scene } from "./Scenes.tsx";
import { SessionPanel } from "./SessionPanel.tsx";
import { THEMES, themeVars, useCurrentLanguage } from "./themes.ts";
import { completeSignInIfRedirected, getIdToken, isSignedIn, signIn } from "./auth.ts";

type State =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "home"; me: MeResponse }
  | { kind: "error"; message: string };

type Screen = "home" | "session" | "account";

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
  const [screen, setScreen] = useState<Screen>("home");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [language, setLanguage] = useCurrentLanguage();
  const theme = THEMES[language];
  // Refresh the totals after a Session settles, without flashing the loading state.
  const refreshMe = () => void loadMe().then(setState, () => undefined);

  useEffect(() => {
    completeSignInIfRedirected()
      .then(() => (isSignedIn() ? loadMe() : { kind: "signed-out" as const }))
      .then(setState)
      .catch((err: unknown) => setState({ kind: "error", message: err instanceof Error ? err.message : String(err) }));
  }, []);

  return (
    <div style={themeVars(theme)} className="min-h-dvh bg-bg font-sans text-ink">
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg sm:border-x-[3px] sm:border-line">
        <div aria-live="polite" className="flex grow flex-col">
          {state.kind === "loading" && <p className="p-5">Loading…</p>}
          {state.kind === "signed-out" && <SignedOut language={language} />}
          {state.kind === "error" && (
            <p className="p-5">
              <span className="dot bad" /> Something went wrong: {state.message}
            </p>
          )}
          {state.kind === "home" && screen === "home" && (
            <Home
              me={state.me}
              language={language}
              onLanguageChange={setLanguage}
              onStartSession={() => setScreen("session")}
            />
          )}
          {/* Always mounted (hidden off its screen) so a Session left unsettled by a closed tab is settled on load. */}
          {state.kind === "home" && (
            <SessionScreen visible={screen === "session"} busy={sessionBusy} onBack={() => setScreen("home")}>
              <SessionPanel
                allowance={state.me.allowance}
                language={language}
                onLanguageChange={setLanguage}
                onSettled={refreshMe}
                onBusyChange={setSessionBusy}
              />
            </SessionScreen>
          )}
          {state.kind === "home" && screen === "account" && <Account />}
        </div>
        {state.kind === "home" && screen !== "session" && <Nav current={screen} go={setScreen} />}
      </main>
    </div>
  );
}

function SignedOut({ language }: { language: keyof typeof THEMES }) {
  const theme = THEMES[language];
  return (
    <div className="flex grow flex-col">
      <div className="relative border-b-[3px] border-line">
        <Scene language={language} height={300} />
        <div className="absolute inset-x-0 bottom-8 flex justify-center">
          <Blob color={theme.body} mood="happy" size={160} label="Blob waving hello" />
        </div>
      </div>
      <div className="flex grow flex-col gap-4 px-5 pb-7 pt-5">
        <h1 className="font-display text-[40px] font-black">Immersr</h1>
        <p className="text-lg leading-snug">
          Live conversation in the language you're acquiring. <b>They speak it. You answer in English.</b>
        </p>
        <div className="grow" />
        <button type="button" className="chunk-btn bg-card text-ink" onClick={() => void signIn()}>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

// Hosts the existing Session flow. Leaving is blocked while a Session is connecting, live or being ended.
function SessionScreen({
  visible,
  busy,
  onBack,
  children,
}: {
  visible: boolean;
  busy: boolean;
  onBack(): void;
  children: ReactNode;
}) {
  return (
    <div className={visible ? "flex grow flex-col" : "hidden"}>
      <header className="flex items-center justify-between border-b-[3px] border-line bg-body px-5 py-3 text-on-body">
        <span className="font-display text-[26px] font-black">Immersr</span>
        <button
          type="button"
          className="pick bg-card"
          style={{ color: "var(--ink)" }}
          disabled={busy}
          onClick={onBack}
        >
          Back to Home
        </button>
      </header>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Nav({ current, go }: { current: "home" | "account"; go(screen: "home" | "account"): void }) {
  const item = "nav-item flex min-h-11 flex-col items-center justify-center gap-1 px-6 text-[13px] font-bold";
  return (
    <nav className="flex justify-around border-t-[3px] border-line bg-card pb-5 pt-2.5">
      <button
        type="button"
        className={`${item} ${current === "home" ? "text-ink" : "text-muted"}`}
        aria-current={current === "home" ? "page" : undefined}
        onClick={() => go("home")}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        Home
      </button>
      <button
        type="button"
        className={`${item} ${current === "account" ? "text-ink" : "text-muted"}`}
        aria-current={current === "account" ? "page" : undefined}
        onClick={() => go("account")}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M4 21c1-4 4-6 8-6s7 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Account
      </button>
    </nav>
  );
}
