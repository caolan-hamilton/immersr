// PROTOTYPE (throwaway, branch prototype/ui-busy). Question: does the busy Blob design hold up as a real,
// clickable flow across every screen, Target language and light/dark? And (option B) what should each
// screen become on a laptop? Open with `pnpm prototype:ui` (dev only, at /?prototype; add &device=desktop).
// All data is fake; nothing is persisted.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Blob, type BlobMood } from "./Blob.tsx";
import { Scene } from "./Scenes.tsx";
import { LANGS, LEVELS, THEMES, TOPIC_SUGGESTIONS, type Lang, type Theme } from "./themes.ts";
import "./prototype.css";

type Screen = "landing" | "home" | "setup" | "session" | "summary" | "account";
const SCREENS: Screen[] = ["landing", "home", "setup", "session", "summary", "account"];
type Mode = "light" | "dark";
type Device = "phone" | "desktop";

interface SessionResult {
  elapsed: number;
  partnerSeconds: number;
}

const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

function readParams() {
  const p = new URLSearchParams(location.search);
  const lang = (LANGS as string[]).includes(p.get("lang") ?? "") ? (p.get("lang") as Lang) : "pt-PT";
  const mode: Mode = p.get("theme") === "dark" ? "dark" : "light";
  const screen = (SCREENS as string[]).includes(p.get("screen") ?? "") ? (p.get("screen") as Screen) : "landing";
  const device: Device = p.get("device") === "desktop" ? "desktop" : "phone";
  return { lang, mode, screen, device };
}

export function PrototypeApp() {
  const initial = readParams();
  const [lang, setLang] = useState<Lang>(initial.lang);
  const [mode, setMode] = useState<Mode>(initial.mode);
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [device, setDevice] = useState<Device>(initial.device);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("A1");
  const [topic, setTopic] = useState("sport");
  const [result, setResult] = useState<SessionResult>({ elapsed: 252, partnerSeconds: 188 });
  const theme = THEMES[lang];
  const wide = device === "desktop";

  useEffect(() => {
    const p = new URLSearchParams({ prototype: "", lang, theme: mode, screen, device });
    history.replaceState(null, "", `?${p.toString().replace("prototype=", "prototype")}`);
  }, [lang, mode, screen, device]);

  const cycle = (dir: 1 | -1) => setLang((l) => LANGS[(LANGS.indexOf(l) + dir + LANGS.length) % LANGS.length]!);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const body = (
    <>
      {screen === "landing" && <Landing theme={theme} wide={wide} onSignIn={() => setScreen("home")} />}
      {screen === "home" && <Home theme={theme} wide={wide} pickLang={setLang} go={setScreen} />}
      {screen === "setup" && (
        <Setup theme={theme} wide={wide} pickLang={setLang} level={level} setLevel={setLevel} topic={topic} setTopic={setTopic} go={setScreen} />
      )}
      {screen === "session" && (
        <Session
          key={lang}
          theme={theme}
          wide={wide}
          level={level}
          topic={topic}
          onEnd={(r) => {
            setResult(r);
            setScreen("summary");
          }}
        />
      )}
      {screen === "summary" && <Summary theme={theme} wide={wide} result={result} go={setScreen} />}
      {screen === "account" && <Account theme={theme} wide={wide} go={setScreen} />}
    </>
  );

  return (
    <div className="proto" data-theme={mode}>
      {wide ? (
        <div className="proto-desktop">
          <div className="proto-desktop__chrome" aria-hidden="true">
            <i /><i /><i /><span>immersr.app</span>
          </div>
          <div className="proto-desktop__viewport">{body}</div>
        </div>
      ) : (
        <div className="proto-phone">{body}</div>
      )}
      {import.meta.env.DEV && (
        <div className="proto-bar" role="toolbar" aria-label="Prototype controls">
          <button type="button" aria-label="Previous language" onClick={() => cycle(-1)}>←</button>
          <span className="lang">{theme.name}</span>
          <button type="button" aria-label="Next language" onClick={() => cycle(1)}>→</button>
          <button type="button" onClick={() => setMode((m) => (m === "light" ? "dark" : "light"))}>{mode === "light" ? "☾ Dark" : "☀ Light"}</button>
          <button type="button" onClick={() => setDevice((d) => (d === "phone" ? "desktop" : "phone"))}>{wide ? "📱 Phone" : "🖥 Desktop"}</button>
          <select aria-label="Jump to screen" value={screen} onChange={(e) => setScreen(e.target.value as Screen)}>
            {SCREENS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function StreakPill() {
  return (
    <span className="pill" style={{ background: "#F2C230", color: "#141414", display: "flex", gap: 6, alignItems: "center" }}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5 0-3 0-6 0-9z" fill="#E8641E" stroke="#141414" strokeWidth="2" strokeLinejoin="round" /></svg>
      4-day streak
    </span>
  );
}

function Header({ theme }: { theme: Theme }) {
  return (
    <div style={{ background: theme.body, color: theme.onBody, padding: "18px 20px", borderBottom: "3px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span className="serif" style={{ fontSize: 26 }}>Immersr</span>
      <StreakPill />
    </div>
  );
}

// Desktop: the bottom Nav becomes a top bar with the links beside the logo.
function TopBar({ theme, current, go }: { theme: Theme; current: "home" | "account" | null; go(s: Screen): void }) {
  return (
    <header style={{ flexShrink: 0, background: theme.body, color: theme.onBody, padding: "14px 32px", borderBottom: "3px solid var(--line)", display: "flex", alignItems: "center", gap: 28 }}>
      <span className="serif" style={{ fontSize: 28 }}>Immersr</span>
      <nav style={{ display: "flex", gap: 6 }}>
        <button type="button" className="toplink" aria-current={current === "home" ? "page" : undefined} onClick={() => go("home")}>Home</button>
        <button type="button" className="toplink" aria-current={current === "account" ? "page" : undefined} onClick={() => go("account")}>Account</button>
      </nav>
      <div style={{ flexGrow: 1 }} />
      <StreakPill />
    </header>
  );
}

function Page({ children, max = 1120 }: { children: ReactNode; max?: number }) {
  return <div style={{ padding: "32px 32px 48px", maxWidth: max, margin: "0 auto", width: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 20 }}>{children}</div>;
}

function Nav({ current, go }: { current: "home" | "account"; go(s: Screen): void }) {
  return (
    <nav className="nav">
      <button type="button" aria-current={current === "home" ? "page" : undefined} onClick={() => go("home")}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>Home
      </button>
      <button type="button" aria-current={current === "account" ? "page" : undefined} onClick={() => go("account")}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>Account
      </button>
    </nav>
  );
}

// A country scene that fills its (positioned) parent, with the Blob standing at the bottom.
function ScenePanel({ theme, mood, size, bottom, label, children }: { theme: Theme; mood: BlobMood; size: number; bottom: number; label?: string; children?: ReactNode }) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <Scene lang={theme.lang} height="100%" fit="contain" />
      </div>
      {children}
      <div style={{ position: "absolute", left: 0, right: 0, bottom, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <Blob color={theme.body} mood={mood} size={size} label={label} />
      </div>
    </>
  );
}

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4" /><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853" /><path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" fill="#FBBC05" /><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.8 9.4 6 12 6z" fill="#EA4335" /></svg>
);

function Landing({ theme, wide, onSignIn }: { theme: Theme; wide: boolean; onSignIn(): void }) {
  const signIn = (
    <button type="button" className="chunk-btn" style={{ background: "#FFFFFF", color: "#141414", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, ...(wide ? { alignSelf: "flex-start", padding: "0 32px" } : {}) }} onClick={onSignIn}>
      <GoogleIcon />
      Sign in with Google
    </button>
  );
  const copy = (
    <>
      <h1 style={{ fontSize: wide ? 72 : 40 }}>Immersr</h1>
      <p style={{ margin: 0, fontSize: wide ? 24 : 18, lineHeight: 1.4, maxWidth: 520 }}>
        Real conversation in the language you're acquiring. <b>They speak it. You answer in English.</b>
      </p>
      <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: wide ? 10 : 6, fontSize: wide ? 18 : 15 }}>
        <li>Pick a language, a Level and a Topic</li>
        <li>Talk with Blob: it only speaks the language you're acquiring</li>
        <li>Watch your hours of Immersion time grow</li>
      </ol>
    </>
  );
  if (wide) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)", flexGrow: 1 }}>
        <div style={{ padding: "56px 64px", display: "flex", flexDirection: "column", gap: 24, justifyContent: "center" }}>
          {copy}
          <div style={{ height: 8 }} />
          {signIn}
        </div>
        <div style={{ position: "relative", borderLeft: "3px solid var(--line)", minHeight: 560 }}>
          <ScenePanel theme={theme} mood="happy" size={260} bottom={60} label="Blob waving hello" />
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <div style={{ position: "relative", borderBottom: "3px solid var(--line)" }}>
        <Scene lang={theme.lang} height={330} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "center" }}>
          <Blob color={theme.body} mood="happy" size={170} label="Blob waving hello" />
        </div>
      </div>
      <div style={{ padding: "22px 22px 28px", display: "flex", flexDirection: "column", gap: 16, flexGrow: 1 }}>
        {copy}
        <div style={{ flexGrow: 1 }} />
        {signIn}
      </div>
    </div>
  );
}

function Stats({ theme }: { theme: Theme }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
      <div className="chunk" style={{ background: "#F2C230", color: "#141414", padding: "10px 12px" }}>
        <div className="serif" style={{ fontSize: 22 }}>{theme.hours}</div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{theme.short} Immersion time</div>
      </div>
      <div className="chunk" style={{ padding: "10px 12px" }}>
        <div className="serif" style={{ fontSize: 22 }}>1 h 20</div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>left today · resets 01:00</div>
      </div>
    </div>
  );
}

function Milestone({ theme, title = "Road to 50 h · following slow, simple speech", pct = 25, scale = true }: { theme: Theme; title?: string; pct?: number; scale?: boolean }) {
  return (
    <div className="chunk" style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div style={{ height: 12, background: "var(--track)", borderRadius: 999, border: "2px solid var(--line)" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: theme.body, borderRadius: 999 }} />
      </div>
      {scale && <div className="muted" style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 500 }}><span>0 h</span><span>You: {theme.hours}</span><span>50 h</span></div>}
    </div>
  );
}

function LangPicks({ theme, pickLang }: { theme: Theme; pickLang(l: Lang): void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
      {LANGS.map((l) => {
        const t = THEMES[l];
        return (
          <button key={l} type="button" className="pick" aria-pressed={l === theme.lang} onClick={() => pickLang(l)} style={{ background: t.body, color: t.onBody, textAlign: "left", outline: l === theme.lang ? "3px solid var(--you)" : undefined, outlineOffset: 2 }}>
            <div style={{ fontSize: 13 }}>{t.short}</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{t.hours === "0 h 00" ? "Start" : t.hours}</div>
          </button>
        );
      })}
    </div>
  );
}

function Home({ theme, wide, pickLang, go }: { theme: Theme; wide: boolean; pickLang(l: Lang): void; go(s: Screen): void }) {
  if (wide) {
    return (
      <>
        <TopBar theme={theme} current="home" go={go} />
        <Page>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
            <div className="chunk" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", height: 320, borderBottom: "3px solid var(--line)" }}>
                <ScenePanel theme={theme} mood="happy" size={170} bottom={26} />
              </div>
              <div style={{ padding: "20px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="serif" style={{ fontSize: 42 }}>{theme.hello}</div>
                <div style={{ fontSize: 18 }}>Ready for today's chat in {theme.short}?</div>
                <button type="button" className="chunk-btn" style={{ background: theme.accent, color: "#FFFFFF", alignSelf: "flex-start", padding: "0 36px", marginTop: 8 }} onClick={() => go("setup")}>Start a Session</button>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Stats theme={theme} />
              <Milestone theme={theme} />
              <div className="chunk" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Your languages</div>
                <LangPicks theme={theme} pickLang={pickLang} />
              </div>
            </div>
          </div>
        </Page>
      </>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <Header theme={theme} />
      <div style={{ padding: "18px 20px 0", display: "flex", flexDirection: "column", gap: 14, flexGrow: 1 }}>
        <div className="chunk" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
          <Blob color={theme.body} mood="happy" size={92} />
          <div>
            <div className="serif" style={{ fontSize: 26 }}>{theme.hello}</div>
            <div style={{ fontSize: 15 }}>Ready for today's chat in {theme.short}?</div>
          </div>
        </div>
        <Stats theme={theme} />
        <Milestone theme={theme} />
        <LangPicks theme={theme} pickLang={pickLang} />
        <div style={{ flexGrow: 1 }} />
        <button type="button" className="chunk-btn" style={{ background: theme.accent, color: "#FFFFFF", marginBottom: 16 }} onClick={() => go("setup")}>Start a Session</button>
      </div>
      <Nav current="home" go={go} />
    </div>
  );
}

interface SetupProps {
  theme: Theme;
  wide: boolean;
  pickLang(l: Lang): void;
  level: (typeof LEVELS)[number];
  setLevel(l: (typeof LEVELS)[number]): void;
  topic: string;
  setTopic(t: string): void;
  go(s: Screen): void;
}

function SetupFields(props: SetupProps) {
  const { theme, level, topic } = props;
  return (
    <>
      <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <legend style={{ fontWeight: 700, marginBottom: 8 }}>Language</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
          {LANGS.map((l) => (
            <button key={l} type="button" className="pick" aria-pressed={l === theme.lang} onClick={() => props.pickLang(l)} style={{ background: l === theme.lang ? THEMES[l].body : undefined, color: l === theme.lang ? THEMES[l].onBody : undefined }}>
              {THEMES[l].short}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 700, marginBottom: 8 }}>Level</legend>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          {LEVELS.map((l) => (
            <button key={l} type="button" className="pick" aria-pressed={l === level} onClick={() => props.setLevel(l)}>{l}</button>
          ))}
        </div>
      </fieldset>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label htmlFor="proto-topic" style={{ fontWeight: 700 }}>Topic</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TOPIC_SUGGESTIONS.map((t) => (
            <button key={t} type="button" className="pick" aria-pressed={t === topic} onClick={() => props.setTopic(t)} style={{ padding: "7px 11px", fontSize: 14 }}>{t}</button>
          ))}
        </div>
        <input id="proto-topic" className="input" maxLength={150} value={topic} onChange={(e) => props.setTopic(e.target.value)} placeholder="or type your own" />
      </div>
    </>
  );
}

function Setup(props: SetupProps) {
  const { theme, level, topic, wide } = props;
  const back = <button type="button" onClick={() => props.go("home")} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "var(--ink)", font: "inherit", fontWeight: 700, cursor: "pointer", padding: 0 }}>← Home</button>;
  if (wide) {
    return (
      <>
        <TopBar theme={theme} current="home" go={props.go} />
        <Page max={1040}>
          {back}
          <h1 style={{ fontSize: 40 }}>New Session</h1>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 28, alignItems: "start" }}>
            <div className="chunk" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 22 }}>
              <SetupFields {...props} />
            </div>
            {/* A live preview of the Session you're about to start, with the Start button beside it. */}
            <div className="chunk" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", height: 230, borderBottom: "3px solid var(--line)" }}>
                <ScenePanel theme={theme} mood="idle" size={130} bottom={16} />
              </div>
              <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="serif" style={{ fontSize: 24 }}>{theme.short} · {level}</div>
                <div style={{ fontSize: 15 }}>Topic: <b>{topic || "anything"}</b></div>
                <div className="muted" style={{ fontSize: 13 }}>Up to 15 minutes · 1 h 20 left today</div>
                <button type="button" className="chunk-btn" style={{ background: theme.accent, color: "#FFFFFF", marginTop: 6 }} onClick={() => props.go("session")}>Start talking</button>
              </div>
            </div>
          </div>
        </Page>
      </>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <Header theme={theme} />
      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 18, flexGrow: 1 }}>
        {back}
        <h1 style={{ fontSize: 30 }}>New Session</h1>
        <SetupFields {...props} />
        <div style={{ flexGrow: 1 }} />
        <div className="muted" style={{ fontSize: 13, textAlign: "center" }}>Up to 15 minutes · 1 h 20 left today</div>
        <button type="button" className="chunk-btn" style={{ background: theme.accent, color: "#FFFFFF" }} onClick={() => props.go("session")}>Start talking</button>
      </div>
    </div>
  );
}

const MOOD_LABEL: Record<BlobMood, string> = { idle: "", speaking: "Speaking…", listening: "Listening…", thinking: "Thinking…", happy: "" };

function Session({ theme, wide, level, topic, onEnd }: { theme: Theme; wide: boolean; level: string; topic: string; onEnd(r: SessionResult): void }) {
  const [shown, setShown] = useState(0);
  const [mood, setMood] = useState<BlobMood>("speaking");
  const [left, setLeft] = useState(900);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [listeningMode, setListeningMode] = useState(false);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const partnerSeconds = useRef(0);

  // A scripted conversation stands in for the realtime events: Partner Turns, the Learner's replies, thinking pauses.
  useEffect(() => {
    if (paused) return;
    const next = theme.transcript[shown];
    const timers: number[] = [];
    if (!next) {
      setMood("listening");
      return;
    }
    if (next.speaker === "Partner") {
      if (shown > 0) {
        setMood("thinking");
        timers.push(window.setTimeout(() => setMood("speaking"), 1400));
      } else setMood("speaking");
      timers.push(window.setTimeout(() => setShown((n) => n + 1), shown > 0 ? 4200 : 2800));
    } else {
      setMood("listening");
      timers.push(window.setTimeout(() => setShown((n) => n + 1), 2600));
    }
    return () => timers.forEach(clearTimeout);
  }, [shown, paused, theme]);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => {
      setLeft((s) => Math.max(0, s - 1));
      if (mood === "speaking") partnerSeconds.current += 1;
    }, 1000);
    return () => clearInterval(t);
  }, [paused, mood]);

  const end = () => onEnd({ elapsed: 900 - left, partnerSeconds: partnerSeconds.current });
  const lines = theme.transcript.slice(0, shown);
  const blobMood = paused ? "idle" : mood;

  const pills = (
    <div style={{ position: "absolute", top: wide ? 18 : 14, left: wide ? 18 : 14, right: wide ? 18 : 14, display: "flex", justifyContent: "space-between" }}>
      <span className="pill" style={{ background: "#FFFFFF", color: "#141414" }}>{theme.short} · {level} · {topic}</span>
      <span className="pill serif" style={{ background: "#F2C230", color: "#141414", fontSize: wide ? 18 : 16 }} aria-label={`${fmtClock(left)} left`}>{fmtClock(left)}</span>
    </div>
  );
  const moodPill = <span className="pill" aria-live="polite" style={{ background: theme.body, color: theme.onBody }}>{paused ? "Paused" : MOOD_LABEL[mood]}</span>;
  const mutedBanner = muted && <div style={{ background: "#F2C230", color: "#141414", fontWeight: 700, fontSize: 14, padding: "8px 16px", borderBottom: "3px solid var(--line)" }}>Your mic is muted. The Partner keeps talking.</div>;
  const transcript = lines.map((line, i) =>
    line.speaker === "Partner" ? (
      <button
        key={i}
        type="button"
        className="chunk"
        onClick={() => setOpen((o) => new Set(o.has(i) ? [...o].filter((x) => x !== i) : [...o, i]))}
        style={{ textAlign: "left", padding: "10px 12px", font: "inherit", color: "var(--ink)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, maxWidth: wide ? "88%" : undefined }}
      >
        <span style={{ fontSize: wide ? 16 : 15, lineHeight: 1.35 }}>{line.text}</span>
        {open.has(i) ? <span className="muted" style={{ fontSize: 13 }}>{line.translation}</span> : <span className="muted" style={{ fontSize: 12 }}>{wide ? "Click to translate" : "Tap to translate"}</span>}
      </button>
    ) : (
      <div key={i} className="chunk" style={{ alignSelf: "flex-end", background: "var(--you)", color: "#141414", padding: "10px 12px", fontSize: wide ? 16 : 15, maxWidth: "78%" }}>{line.text}</div>
    ),
  );
  const controls = (
    <div style={{ flexShrink: 0, padding: wide ? "14px 24px" : "12px 14px 22px", background: "var(--card)", borderTop: "3px solid var(--line)", display: "flex", gap: wide ? 12 : 8, alignItems: "center" }}>
      <button type="button" className="icon-btn" aria-label={muted ? "Unmute your microphone" : "Mute your microphone"} aria-pressed={muted} onClick={() => setMuted((m) => !m)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />{muted && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}</svg>
      </button>
      <button type="button" className="icon-btn" aria-label="Pause the Session" onClick={() => setPaused(true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      </button>
      <button type="button" className="icon-btn" aria-label="Listening mode" aria-pressed={listeningMode} onClick={() => setListeningMode((v) => !v)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="3" y="14" width="5" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /><rect x="16" y="14" width="5" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
      </button>
      {wide && <div style={{ flexGrow: 1 }} />}
      <button type="button" className="chunk-btn" style={{ flexGrow: wide ? 0 : 1, minWidth: wide ? 200 : undefined, minHeight: 54, background: theme.accent, color: "#FFFFFF" }} onClick={end}>End</button>
    </div>
  );
  const pauseDialog = paused && (
    <div role="dialog" aria-modal="true" aria-labelledby="proto-paused" style={{ position: "absolute", inset: 0, background: "rgba(20,20,20,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 5 }}>
      <div className="chunk" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12, alignItems: "center", textAlign: "center", maxWidth: 420 }}>
        <Blob color={theme.body} mood="idle" size={100} />
        <h2 id="proto-paused" style={{ fontSize: 24 }}>Paused</h2>
        <p style={{ margin: 0 }}>Session time keeps running while paused. For a long break, End and start again later: unused time is returned.</p>
        <button type="button" className="chunk-btn" style={{ background: theme.body, color: theme.onBody, width: "100%" }} onClick={() => setPaused(false)}>Resume</button>
        <button type="button" className="chunk-btn" style={{ background: "var(--card)", color: "var(--ink)", width: "100%" }} onClick={end}>End Session</button>
      </div>
    </div>
  );

  if (wide) {
    // Desktop: the scene and Blob fill the left; the Transcript is a full-height column on the right.
    // Listening mode drops the Transcript column so the scene takes the whole window.
    return (
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0, position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: listeningMode ? "1fr" : "minmax(0, 1.2fr) minmax(0, 1fr)", flexGrow: 1, minHeight: 0 }}>
          <div style={{ position: "relative", minHeight: 0, overflow: "hidden" }}>
            <ScenePanel theme={theme} mood={blobMood} size={listeningMode ? 300 : 240} bottom={60} label={`The Partner is ${paused ? "paused" : mood}`}>
              {pills}
            </ScenePanel>
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 14, display: "flex", justifyContent: "center" }}>{moodPill}</div>
          </div>
          {!listeningMode && (
            <div style={{ borderLeft: "3px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div style={{ padding: "14px 20px", borderBottom: "3px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "baseline", background: "var(--card)" }}>
                <span className="serif" style={{ fontSize: 20 }}>Transcript</span>
                <span className="muted" style={{ fontSize: 13 }}>Click a line to translate it</span>
              </div>
              {mutedBanner}
              <div style={{ flexGrow: 1, minHeight: 0, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>{transcript}</div>
            </div>
          )}
        </div>
        {listeningMode && mutedBanner}
        {controls}
        {pauseDialog}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, position: "relative" }}>
      <div style={{ position: "relative", borderBottom: "3px solid var(--line)" }}>
        <Scene lang={theme.lang} height={listeningMode ? 470 : 300} />
        {pills}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Blob color={theme.body} mood={blobMood} size={listeningMode ? 210 : 150} label={`The Partner is ${paused ? "paused" : mood}`} />
          {moodPill}
        </div>
      </div>
      {mutedBanner}
      <div style={{ flexGrow: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: listeningMode ? undefined : 330 }}>
        {listeningMode ? <p className="muted" style={{ margin: "auto 0", textAlign: "center", fontSize: 15 }}>Listening mode: no Transcript, just listen.</p> : transcript}
      </div>
      {controls}
      {pauseDialog}
    </div>
  );
}

function Summary({ theme, wide, result, go }: { theme: Theme; wide: boolean; result: SessionResult; go(s: Screen): void }) {
  const returned = Math.max(0, 900 - result.elapsed);
  const stats = (
    <>
      <div className="chunk" style={{ background: "#F2C230", color: "#141414", padding: "14px 16px" }}>
        <div className="serif" style={{ fontSize: wide ? 40 : 30 }}>+{fmtDur(result.partnerSeconds)}</div>
        <div style={{ fontWeight: 500 }}>Immersion time added</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <div className="chunk" style={{ padding: "10px 12px" }}>
          <div className="serif" style={{ fontSize: 20 }}>{fmtDur(returned)}</div>
          <div style={{ fontSize: 13 }}>returned to today's allowance</div>
        </div>
        <div className="chunk" style={{ padding: "10px 12px" }}>
          <div className="serif" style={{ fontSize: 20 }}>{theme.hours}</div>
          <div style={{ fontSize: 13 }}>{theme.short} in total</div>
        </div>
      </div>
      <Milestone theme={theme} title="Road to 50 h" pct={26} scale={false} />
    </>
  );
  const back = <button type="button" className="chunk-btn" style={{ background: theme.accent, color: "#FFFFFF", ...(wide ? { alignSelf: "flex-start", padding: "0 36px" } : {}) }} onClick={() => go("home")}>Back to Home</button>;
  if (wide) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", flexGrow: 1 }}>
        <div style={{ position: "relative", borderRight: "3px solid var(--line)", minHeight: 560 }}>
          <ScenePanel theme={theme} mood="happy" size={240} bottom={50} label="Blob celebrating" />
        </div>
        <div style={{ padding: "48px 56px", display: "flex", flexDirection: "column", gap: 16, justifyContent: "center", maxWidth: 560 }}>
          <h1 style={{ fontSize: 56 }}>{theme.wellDone}</h1>
          {stats}
          <div style={{ height: 4 }} />
          {back}
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <div style={{ position: "relative", borderBottom: "3px solid var(--line)" }}>
        <Scene lang={theme.lang} height={260} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 20, display: "flex", justifyContent: "center" }}>
          <Blob color={theme.body} mood="happy" size={140} label="Blob celebrating" />
        </div>
      </div>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 12, flexGrow: 1 }}>
        <h1 style={{ fontSize: 30 }}>{theme.wellDone}</h1>
        {stats}
        <div style={{ flexGrow: 1 }} />
        {back}
      </div>
    </div>
  );
}

function Account({ theme, wide, go }: { theme: Theme; wide: boolean; go(s: Screen): void }) {
  const [confirming, setConfirming] = useState(false);
  const content = (
    <>
      <h1 style={{ fontSize: wide ? 40 : 30 }}>Account</h1>
      <div className="chunk" style={{ padding: "14px 16px" }}>
        <div style={{ fontWeight: 700 }}>Signed in with Google</div>
        <div className="muted">learner@example.com</div>
      </div>
      <a href="#privacy" style={{ color: "var(--ink)", fontWeight: 700 }}>Privacy: what Immersr stores</a>
      <button type="button" className="chunk-btn" style={{ background: "var(--card)", color: "var(--ink)", ...(wide ? { alignSelf: "flex-start", padding: "0 36px" } : {}) }} onClick={() => go("landing")}>Sign out</button>
      {confirming ? (
        <div className="chunk" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700 }}>Delete your account?</div>
          <div style={{ fontSize: 14 }}>This removes your Immersion time, Sessions and sign-in for good.</div>
          <button type="button" className="chunk-btn" style={{ background: "#C8352A", color: "#FFFFFF" }} onClick={() => go("landing")}>Delete for good</button>
          <button type="button" className="chunk-btn" style={{ background: "var(--card)", color: "var(--ink)" }} onClick={() => setConfirming(false)}>Keep my account</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#C8352A", font: "inherit", fontWeight: 700, cursor: "pointer", padding: 0 }}>Delete my account</button>
      )}
    </>
  );
  if (wide) {
    return (
      <>
        <TopBar theme={theme} current="account" go={go} />
        <Page max={600}>{content}</Page>
      </>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14, flexGrow: 1 }}>{content}</div>
      <Nav current="account" go={go} />
    </div>
  );
}
