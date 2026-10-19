import { useEffect, useRef, useState } from "react";
import {
  LANGUAGES,
  LEVELS,
  TOPIC_MAX_LENGTH,
  type EndSessionResponse,
  type Language,
  type Level,
  type MeResponse,
} from "@immersr/shared";
import { formatCountdown, formatDuration, formatTimeOfDay, languageName } from "./format.ts";
import { deliverPendingEnd, loadPendingEnd, savePendingEnd, type PendingEnd } from "./pending-end.ts";
import {
  MicrophoneBlockedError,
  SessionRefusedError,
  startSession,
  type LiveSession,
  type TurnSpeaker,
} from "./session-client.ts";

interface Turn {
  speaker: TurnSpeaker;
  text: string;
}

type Phase = "setup" | "connecting" | "live" | "ending" | "end-failed";

const refusalMessage = (reason: SessionRefusedError["reason"], resetsAt: string) =>
  reason === "daily-allowance"
    ? `You've used all of today's allowance. It resets at ${formatTimeOfDay(resetsAt)}.`
    : "Immersr has reached its capacity for today, so no new Sessions can start right now. This isn't your own allowance. Please try again tomorrow.";

export function SessionPanel({ allowance, onSettled }: { allowance: MeResponse["allowance"]; onSettled(): void }) {
  const remaining = Math.max(0, allowance.limitSeconds - allowance.usedSeconds);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [summary, setSummary] = useState<EndSessionResponse>();
  const finishing = useRef(false);
  // The Session the server hasn't settled yet, kept so a failed End can be retried.
  // Also saved on the device, so it survives a closed tab or a reload.
  const unsettled = useRef<PendingEnd | undefined>(loadPendingEnd());
  const retrying = useRef(false);
  const [language, setLanguage] = useState<Language>("pt-PT");
  const [level, setLevel] = useState<Level>("A1");
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [micBlocked, setMicBlocked] = useState(false);
  const live = useRef<LiveSession | undefined>(undefined);

  // Hang up if the Learner navigates away mid-Session.
  useEffect(() => () => live.current?.end(), []);

  // If the tab closes or reloads mid-Session, keep the Session on the device so the next load can End it.
  useEffect(() => {
    const keepForRetry = () => {
      const session = live.current;
      if (session) savePendingEnd({ sessionId: session.sessionId, partnerSeconds: session.partnerSeconds() });
    };
    window.addEventListener("pagehide", keepForRetry);
    return () => window.removeEventListener("pagehide", keepForRetry);
  }, []);

  // Closes the connection, then has the server hang up and settle. Safe to call twice (End, countdown, drop).
  const finish = async () => {
    const session = live.current;
    if (!session || finishing.current) return;
    finishing.current = true;
    setPhase("ending");
    setDraft("");
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
    setTurns([]);
    setDraft("");
    try {
      live.current = await startSession(
        { language, level, topic },
        {
          onPartnerDraft: setDraft,
          onTurn: (speaker, text) => setTurns((previous) => [...previous, { speaker, text }]),
          onError: setError,
          onDisconnected: () => {
            setError("The connection to the Partner was lost. The Session has ended.");
            void finishRef.current();
          },
        },
      );
      // Saved straight away, so even a crash leaves something to End (with 0 Partner seconds, as the server expects of an unreported Session).
      savePendingEnd({ sessionId: live.current.sessionId, partnerSeconds: 0 });
      setPhase("live");
    } catch (err) {
      if (err instanceof MicrophoneBlockedError) setMicBlocked(true);
      else if (err instanceof SessionRefusedError) setError(refusalMessage(err.reason, allowance.resetsAt));
      else setError(err instanceof Error ? err.message : String(err));
      setPhase("setup");
    }
  };

  return (
    <>
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
              <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
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
      {phase === "live" && (
        <p>
          <b aria-label="Time left in this Session">{formatCountdown(secondsLeft)}</b> left{" "}
          <button onClick={() => void finish()}>End</button>
        </p>
      )}
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
      {(turns.length > 0 || draft) && (
        <ul className="transcript" aria-live="polite">
          {turns.map((turn, i) => (
            <li key={i}>
              <b>{turn.speaker === "Partner" ? "Partner" : "You"}:</b> {turn.text}
            </li>
          ))}
          {draft && (
            <li className="muted">
              <b>Partner:</b> {draft}
            </li>
          )}
        </ul>
      )}
    </>
  );
}
