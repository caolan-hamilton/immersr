import { useEffect, useState, type ReactNode } from "react";
import { MeResponse } from "@immersr/shared";
import { Account } from "./Account.tsx";
import { Home } from "./Home.tsx";
import { Landing } from "./Landing.tsx";
import { AppLoader } from "./Loading.tsx";
import { Offline } from "./Offline.tsx";
import { useOnline } from "./online.ts";
import { Privacy } from "./Privacy.tsx";
import { BottomNav, TopBar } from "./Nav.tsx";
import { SessionPanel } from "./SessionPanel.tsx";
import { NEUTRAL_THEME, storedLanguage, THEMES, themeVars, useCurrentLanguage } from "./themes.ts";
import { completeSignInIfRedirected, getIdToken, isSignedIn } from "./auth.ts";

type State =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "home"; me: MeResponse }
  | { kind: "error"; message: string };

type Screen = "home" | "session" | "account" | "privacy";

async function loadMe(): Promise<State> {
  const token = await getIdToken();
  if (!token) return { kind: "signed-out" };
  const timeZone = encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const response = await fetch(`/api/me?timeZone=${timeZone}`, { headers: { authorization: `Bearer ${token}` } });
  if (response.status === 401) return { kind: "signed-out" };
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  return { kind: "home", me: MeResponse.parse(await response.json()) };
}

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [screen, setScreen] = useState<Screen>("home");
  // Signed-out visitors read the Privacy screen from Landing.
  const [visitorReadingPrivacy, setVisitorReadingPrivacy] = useState(false);
  const [language, setLanguage] = useCurrentLanguage();
  // The app-start loader wears the last Target language's theme if this device knows it, else a neutral one.
  const [languageKnown] = useState(() => storedLanguage() !== undefined);
  const theme = state.kind === "loading" && !languageKnown ? NEUTRAL_THEME : THEMES[language];
  // Refresh the totals after a Session settles, without flashing the loading state.
  const refreshMe = () => void loadMe().then(setState, () => undefined);

  useEffect(() => {
    completeSignInIfRedirected()
      .then(() => (isSignedIn() ? loadMe() : { kind: "signed-out" as const }))
      .then(setState)
      .catch((err: unknown) => setState({ kind: "error", message: err instanceof Error ? err.message : String(err) }));
  }, []);

  // A live Session keeps its own screen even if the connection blips; everywhere else offline gets the friendly screen.
  const online = useOnline();
  if (!online && !(state.kind === "home" && screen === "session")) {
    return (
      <div style={themeVars(theme)}>
        <Offline color={theme.body} />
      </div>
    );
  }

  return (
    <div style={themeVars(theme)} className="min-h-dvh bg-bg font-sans text-ink">
      <main className="flex min-h-dvh w-full flex-col bg-bg">
        {state.kind === "home" && screen !== "session" && <TopBar current={screen === "privacy" ? "account" : screen} go={setScreen} streak={state.me.streak} />}
        <div aria-live="polite" className="flex grow flex-col">
          {state.kind === "loading" && <AppLoader color={theme.body} />}
          {state.kind === "signed-out" &&
            (visitorReadingPrivacy ? (
              <Privacy backLabel="the start page" onBack={() => setVisitorReadingPrivacy(false)} />
            ) : (
              <Landing language={language} onPrivacy={() => setVisitorReadingPrivacy(true)} />
            ))}
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
            <SessionScreen visible={screen === "session"}>
              <SessionPanel
                onBack={() => setScreen("home")}
                allowance={state.me.allowance}
                immersion={state.me.immersion}
                language={language}
                onLanguageChange={setLanguage}
                streak={state.me.streak}
                onNavigate={setScreen}
                onSettled={refreshMe}
              />
            </SessionScreen>
          )}
          {state.kind === "home" && screen === "account" && <Account onPrivacy={() => setScreen("privacy")} />}
          {state.kind === "home" && screen === "privacy" && <Privacy backLabel="Account" onBack={() => setScreen("account")} />}
        </div>
        {state.kind === "home" && screen !== "session" && <BottomNav current={screen === "privacy" ? "account" : screen} go={setScreen} />}
      </main>
    </div>
  );
}

// Hosts Setup and the Session flow. Hidden, not unmounted, off its screen.
function SessionScreen({ visible, children }: { visible: boolean; children: ReactNode }) {
  return <div className={visible ? "flex grow flex-col" : "hidden"}>{children}</div>;
}
