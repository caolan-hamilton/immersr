import { useEffect, useReducer, useRef, useState } from "react";
import {
  LANGUAGES,
  LEVELS,
  TOPIC_MAX_LENGTH,
  type EndSessionResponse,
  type Language,
  type Level,
  type MeResponse,
} from "@immersr/shared";
import { formatDuration, formatTimeOfDay, languageName } from "./format.ts";
import { LiveSession } from "./LiveSession.tsx";
import { initialSessionState, needsTranslation, sessionReducer } from "./session-state.ts";
import { clearPendingEnd, deliverPendingEnd, loadPendingEnd, savePendingEnd, type PendingEnd } from "./pending-end.ts";
import {
  MicrophoneBlockedError,
  SessionRefusedError,
  startSession,
  TranslationLimitError,
  translateTurn,
  type LiveSession as LiveConnection,
} from "./session-client.ts";

const TRANSLATION_LIMIT_MESSAGE = "You've reached today's translation limit. It resets at midnight UTC.";

type Phase = "setup" | "connecting" | "live" | "ending" | "end-failed";

const refusalMessage = (reason: SessionRefusedError["reason"], resetsAt: string) =>
  reason === "daily-allowance"
    ? `You've used all of today's allowance. It resets at ${formatTimeOfDay(resetsAt)}.`
    : "Immersr has reached its capacity for today, so no new Sessions can start right now. This isn't your own allowance. Please try again tomorrow.";

interface SessionPanelProps {
  allowance: MeResponse["allowance"];
  language: Language;
  onLanguageChange(language: Language): void;
  onSettled(): void;
  /** Tells the screen shell whether a Session is connecting, live or being ended, so it can stay put. */
  onBusyChange(busy: boolean): void;
}

export function SessionPanel({ allowance, language, onLanguageChange, onSettled, onBusyChange }: SessionPanelProps) {
  const remaining = Math.max(0, allowance.limitSeconds - allowance.usedSeconds);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [summary, setSummary] = useState<EndSessionResponse>();
  const finishing = useRef(false);
  // The Session the server hasn't settled yet, kept so a failed End can be retried.
  // Also saved on the device, so it survives a closed tab or a reload.
  const unsettled = useRef<PendingEnd | undefined>(loadPendingEnd());
  const retrying = useRef(false);
  const [level, setLevel] = useState<Level>("A1");
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [session, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [error, setError] = useState<string>();
  const [micBlocked, setMicBlocked] = useState(false);
  const live = useRef<LiveConnection | undefined>(undefined);
  // The live Session that Turn translations are asked for.
  const transcriptSession = useRef<string | undefined>(undefined);

  const toggleTranslation = async (index: number) => {
    const sessionId = transcriptSession.current;
    const text = session.turns[index]?.text;
    if (!sessionId || text === undefined) return;
    const asking = needsTranslation(session, index);
    dispatch({ kind: "toggle-translation", index });
    if (!asking) return;
    // A late answer from an earlier Session must not land on a Turn of the current one.
    const stillThisSession = () => transcriptSession.current === sessionId;
    try {
      const translated = await translateTurn(sessionId, text);
      if (stillThisSession()) dispatch({ kind: "translation-arrived", index, text: translated });
    } catch (err) {
      if (!stillThisSession()) return;
      const message = err instanceof TranslationLimitError ? TRANSLATION_LIMIT_MESSAGE : err instanceof Error ? err.message : String(err);
      dispatch({ kind: "translation-failed", index, message });
    }
  };

  // Hang up if the Learner navigates away mid-Session.
  useEffect(() => () => live.current?.end(), []);

  // If the tab closes or reloads mid-Session, keep the Session on the device so the next load can End it.
  // Nothing is saved while the Session is simply live, so a second tab never Ends a Session another tab is running.
  useEffect(() => {
    const keepForRetry = () => {
      const session = live.current;
      if (session) savePendingEnd({ sessionId: session.sessionId, partnerSeconds: session.partnerSeconds() });
    };
    // A tab restored from the back/forward cache is still live, so its saved entry must not be retried elsewhere.
    const dropIfStillLive = (event: PageTransitionEvent) => {
      if (event.persisted && live.current) clearPendingEnd();
    };
    window.addEventListener("pagehide", keepForRetry);
    window.addEventListener("pageshow", dropIfStillLive);
    return () => {
      window.removeEventListener("pagehide", keepForRetry);
      window.removeEventListener("pageshow", dropIfStillLive);
    };
  }, []);

  useEffect(() => onBusyChange(phase !== "setup"), [phase]);

  // Closes the connection, then has the server hang up and settle. Safe to call twice (End, countdown, drop).
  const finish = async () => {
    const session = live.current;
    if (!session || finishing.current) return;
    finishing.current = true;
    setPhase("ending");
    dispatch({ kind: "partner-draft", text: "" });
    unsettled.current = { sessionId: session.sessionId, partnerSeconds: session.partnerSeconds() };
    savePendingEnd(unsettled.current);
    session.end();
    live.current = undefined;
    await settleUnsettled();
  };

  // Asks the server to hang up and settle. On failure the Session stays active and charged, so offer a retry.
  const settleUnsettled = async () => {
    const pending = unsettled.current;
    if (!pending) return;
    setPhase("ending");
    setError(undefined);
    try {
      setSummary(await deliverPendingEnd(pending));
      unsettled.current = undefined;
      finishing.current = false;
      setPhase("setup");
      onSettled();
    } catch (err) {
      finishing.current = false;
      const reason = err instanceof Error ? err.message : String(err);
      setError(`${reason} The Session isn't settled yet, so your full allowance is still held. Please try again.`);
      setPhase("end-failed");
    }
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  // A Session left unsettled by a drop or a closed tab is settled quietly when the app loads or comes back online.
  useEffect(() => {
    const retryInBackground = async () => {
      const pending = unsettled.current;
      if (!pending || live.current || finishing.current || retrying.current) return;
      retrying.current = true;
      try {
        const result = await deliverPendingEnd(pending);
        unsettled.current = undefined;
        if (result) setSummary(result);
        setError(undefined);
        setPhase("setup");
        onSettledRef.current();
      } catch {
        // Still unreachable: the entry stays saved and the next load or online event tries again.
      } finally {
        retrying.current = false;
      }
    };
    void retryInBackground();
    window.addEventListener("online", retryInBackground);
    return () => window.removeEventListener("online", retryInBackground);
  }, []);

  // Count down to the end time; at zero the Session is over whether or not the server hang-up has fired.
  useEffect(() => {
    if (phase !== "live" || !live.current) return;
    const endsAt = Date.parse(live.current.endsAt);
    const tick = () => {
      const left = (endsAt - Date.now()) / 1000;
      setSecondsLeft(left);
      if (left <= 0) void finishRef.current();
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [phase]);

  const start = async () => {
    // A previous Session still waiting to be settled is dealt with first, so its saved End isn't overwritten.
    if (unsettled.current) {
      await settleUnsettled();
      if (unsettled.current) return;
    }
    setPhase("connecting");
    setSummary(undefined);
    setError(undefined);
    setMicBlocked(false);
    dispatch({ kind: "reset" });
    transcriptSession.current = undefined;
    try {
      live.current = await startSession(
        { language, level, topic },
        {
          onRealtimeEvent: (type) => dispatch({ kind: "realtime", type }),
          onPartnerDraft: (text) => dispatch({ kind: "partner-draft", text }),
          onTurn: (speaker, text) => dispatch({ kind: "turn", speaker, text }),
          onError: setError,
          onDisconnected: () => {
            setError("The connection to the Partner was lost. The Session has ended.");
            void finishRef.current();
          },
        },
      );
      transcriptSession.current = live.current.sessionId;
      setPhase("live");
    } catch (err) {
      if (err instanceof MicrophoneBlockedError) setMicBlocked(true);
      else if (err instanceof SessionRefusedError) setError(refusalMessage(err.reason, allowance.resetsAt));
      else setError(err instanceof Error ? err.message : String(err));
      setPhase("setup");
    }
  };

  if (phase === "live") {
    return (
      <div className="flex grow flex-col">
        <LiveSession
          language={language}
          level={level}
          topic={topic}
          secondsLeft={secondsLeft}
          state={session}
          onToggleTranslation={(index) => void toggleTranslation(index)}
          onEnd={() => void finish()}
        />
        {error && (
          <p role="alert" className="m-0 border-t-[3px] border-line bg-card px-4 py-2 text-sm">
            <span className="dot bad" /> {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="session-panel p-5">
      <h2>Talk to the Partner</h2>
      {phase === "setup" && summary && (
        <p role="status">
          Session over. <b>{formatDuration(summary.immersionSeconds)}</b> added to your Immersion time (
          {summary.immersionSeconds}s of the Partner speaking, {formatDuration(summary.chargedSeconds)} of your allowance
          used).
        </p>
      )}
      {phase === "setup" && (
        <p className="muted">
          {formatDuration(remaining)} of your daily allowance left. It resets at {formatTimeOfDay(allowance.resetsAt)}.
        </p>
      )}
      {phase === "setup" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <p>
            <label>
              Language{" "}
              <select value={language} onChange={(e) => onLanguageChange(e.target.value as Language)}>
                {LANGUAGES.map((code) => (
                  <option key={code} value={code}>
                    {languageName(code)} ({code})
                  </option>
                ))}
              </select>
            </label>{" "}
            <label>
              Level{" "}
              <select value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
          </p>
          <p>
            <label>
              Topic{" "}
              <input
                value={topic}
                maxLength={TOPIC_MAX_LENGTH}
                placeholder="e.g. my last holiday"
                onChange={(e) => setTopic(e.target.value)}
              />
            </label>{" "}
            <button type="submit" disabled={!topic.trim()}>
              Start
            </button>
          </p>
        </form>
      )}
      {phase === "connecting" && <p>Connecting…</p>}
      {phase === "ending" && <p>Ending the Session…</p>}
      {phase === "end-failed" && (
        <p>
          <button onClick={() => void settleUnsettled()}>Retry ending the Session</button>
        </p>
      )}
      {micBlocked && (
        <p role="alert">
          <span className="dot bad" /> Immersr can't use your microphone. Click the lock or camera icon in your browser's
          address bar, set Microphone to Allow, then reload this page and press Start again.
        </p>
      )}
      {error && (
        <p role="alert">
          <span className="dot bad" /> {error}
        </p>
      )}
      {/* Translations only work while the Session is live; once it ends the Transcript is plain text. */}
      {session.turns.length > 0 && (
        <ul className="transcript">
          {session.turns.map((turn, i) => (
            <li key={i}>
              <b>{turn.speaker === "Partner" ? "Partner" : "You"}:</b> {turn.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
