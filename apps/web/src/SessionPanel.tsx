import { useEffect, useReducer, useRef, useState } from "react";
import { type EndSessionResponse, type Language, type MeResponse } from "@immersr/shared";
import { formatTimeOfDay } from "./format.ts";
import { useLevel } from "./level.ts";
import { readListeningMode, saveListeningMode } from "./listening-mode.ts";
import { LiveSession } from "./LiveSession.tsx";
import type { NavScreen } from "./Nav.tsx";
import { initialSessionState, needsTranslation, sessionReducer } from "./session-state.ts";
import { Setup } from "./Setup.tsx";
import { Summary } from "./Summary.tsx";
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

type Phase = "setup" | "connecting" | "live" | "ending" | "end-failed" | "summary";

/** A settled Session, with the Target language and Immersion time it started from. */
interface SettledSession {
  result: EndSessionResponse;
  language: Language;
  beforeSeconds: number;
}

const refusalMessage = (reason: SessionRefusedError["reason"], resetsAt: string) =>
  reason === "daily-allowance"
    ? `You've used all of today's allowance. It resets at ${formatTimeOfDay(resetsAt)}.`
    : "Immersr has reached its capacity for today, so no new Sessions can start right now. This isn't your own allowance. Please try again tomorrow.";

interface SessionPanelProps {
  allowance: MeResponse["allowance"];
  immersion: MeResponse["immersion"];
  language: Language;
  onLanguageChange(language: Language): void;
  streak: number;
  onNavigate(screen: NavScreen): void;
  onSettled(): void;
  onBack(): void;
}

export function SessionPanel({ allowance, immersion, language, onLanguageChange, streak, onNavigate, onSettled, onBack }: SessionPanelProps) {
  const remaining = Math.max(0, allowance.limitSeconds - allowance.usedSeconds);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [summary, setSummary] = useState<SettledSession>();
  // The Target language and Immersion time the running Session started from, for the Summary.
  const startedFrom = useRef<{ language: Language; beforeSeconds: number } | undefined>(undefined);
  const finishing = useRef(false);
  // Which Start is current; Cancel bumps it so a connection that completes later is hung up.
  const startAttempt = useRef(0);
  // The Session the server hasn't settled yet, kept so a failed End can be retried.
  // Also saved on the device, so it survives a closed tab or a reload.
  const unsettled = useRef<PendingEnd | undefined>(loadPendingEnd());
  const retrying = useRef(false);
  const [level, setLevel] = useLevel();
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [session, dispatch] = useReducer(sessionReducer, undefined, () => ({
    ...initialSessionState,
    listeningMode: readListeningMode(),
  }));
  useEffect(() => saveListeningMode(session.listeningMode), [session.listeningMode]);
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
      const result = await deliverPendingEnd(pending);
      unsettled.current = undefined;
      finishing.current = false;
      // Without a start in this page load there is nothing to compare against, so no Summary.
      if (result && startedFrom.current) {
        setSummary({ result, ...startedFrom.current });
        setPhase("summary");
      } else setPhase("setup");
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
        await deliverPendingEnd(pending);
        unsettled.current = undefined;
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
    const attempt = ++startAttempt.current;
    const cancelled = () => startAttempt.current !== attempt;
    setPhase("connecting");
    setSummary(undefined);
    startedFrom.current = { language, beforeSeconds: immersion[language] ?? 0 };
    setError(undefined);
    setMicBlocked(false);
    dispatch({ kind: "reset" });
    transcriptSession.current = undefined;
    try {
      const started = await startSession(
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
      if (cancelled()) {
        // Cancelled while connecting: the server may already hold a Reservation, so hang up and settle it quietly.
        const pending = { sessionId: started.sessionId, partnerSeconds: 0 };
        unsettled.current = pending;
        savePendingEnd(pending);
        started.end();
        void deliverPendingEnd(pending).then(
          () => {
            if (unsettled.current === pending) unsettled.current = undefined;
            onSettledRef.current();
          },
          () => undefined, // stays saved and unsettled: the next Start or online event retries
        );
        return;
      }
      live.current = started;
      transcriptSession.current = started.sessionId;
      setPhase("live");
    } catch (err) {
      if (cancelled()) return;
      if (err instanceof MicrophoneBlockedError) setMicBlocked(true);
      else if (err instanceof SessionRefusedError) setError(refusalMessage(err.reason, allowance.resetsAt));
      else setError(err instanceof Error ? err.message : String(err));
      setPhase("setup");
    }
  };

  const cancelStart = () => {
    startAttempt.current++;
    setError(undefined);
    setPhase("setup");
  };

  if (phase === "live" || phase === "connecting") {
    return (
      // On a wide window the Session fills the window exactly: the Transcript scrolls inside it, not the page.
      <div className="flex grow flex-col desk:h-dvh">
        <LiveSession
          language={language}
          level={level}
          topic={topic}
          secondsLeft={secondsLeft}
          state={session}
          onToggleTranslation={(index) => void toggleTranslation(index)}
          onToggleMute={() => {
            live.current?.setMuted(!session.muted);
            dispatch({ kind: session.muted ? "unmute" : "mute" });
          }}
          onPause={() => {
            live.current?.setPaused(true);
            dispatch({ kind: "pause" });
          }}
          onResume={() => {
            live.current?.setPaused(false);
            dispatch({ kind: "resume" });
          }}
          onToggleListeningMode={() => dispatch({ kind: "toggle-listening-mode" })}
          onEnd={() => void finish()}
          connecting={phase === "connecting"}
          onCancel={cancelStart}
        />
        {error && (
          <p role="alert" className="m-0 border-t-[3px] border-line bg-card px-4 py-2 text-sm">
            <span className="dot bad" /> {error}
          </p>
        )}
      </div>
    );
  }

  // Ending shows the Summary as a skeleton at once; the numbers fill in when the server's result arrives.
  if (phase === "ending" || phase === "end-failed" || (phase === "summary" && summary)) {
    const waitingOn = summary ?? startedFrom.current ?? { language, beforeSeconds: immersion[language] ?? 0 };
    return (
      <Summary
        language={waitingOn.language}
        result={phase === "summary" ? summary?.result : undefined}
        endFailure={phase === "end-failed" && error ? { message: error, onRetry: () => void settleUnsettled() } : undefined}
        beforeSeconds={waitingOn.beforeSeconds}
        onBackToHome={() => {
          setPhase("setup");
          onBack();
        }}
      />
    );
  }

  if (phase === "setup") {
    return (
      <div className="flex grow flex-col">
        <Setup
          language={language}
          onLanguageChange={onLanguageChange}
          level={level}
          onLevelChange={setLevel}
          topic={topic}
          onTopicChange={setTopic}
          remainingSeconds={remaining}
          streak={streak}
          onNavigate={onNavigate}
          error={error}
          micBlocked={micBlocked}
          onBack={onBack}
          onStart={() => void start()}
        />
      </div>
    );
  }

  return null;
}
