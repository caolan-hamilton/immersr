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
import {
  MicrophoneBlockedError,
  reportEnd,
  SessionRefusedError,
  startSession,
  TranslationLimitError,
  translateTurn,
  type LiveSession,
  type TurnSpeaker,
} from "./session-client.ts";

interface Turn {
  speaker: TurnSpeaker;
  text: string;
}

/** A Partner Turn's Turn translation, kept per Turn so tapping again never asks (or counts) twice. */
type TurnTranslation = { state: "loading" } | { state: "done"; text: string } | { state: "failed"; message: string };

const TRANSLATION_LIMIT_MESSAGE = "You've reached today's translation limit. It resets at midnight UTC.";

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
  const unsettled = useRef<{ sessionId: string; partnerSeconds: number } | undefined>(undefined);
  const [language, setLanguage] = useState<Language>("pt-PT");
  const [level, setLevel] = useState<Level>("A1");
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const [micBlocked, setMicBlocked] = useState(false);
  const live = useRef<LiveSession | undefined>(undefined);
  const [translations, setTranslations] = useState<Record<number, TurnTranslation>>({});
  // The live Session that Turn translations are asked for.
  const transcriptSession = useRef<string | undefined>(undefined);

  const showTranslation = async (index: number, text: string) => {
    const sessionId = transcriptSession.current;
    if (!sessionId || translations[index]?.state === "loading" || translations[index]?.state === "done") return;
    setTranslations((previous) => ({ ...previous, [index]: { state: "loading" } }));
    try {
      const translation = await translateTurn(sessionId, text);
      setTranslations((previous) => ({ ...previous, [index]: { state: "done", text: translation } }));
    } catch (err) {
      const message = err instanceof TranslationLimitError ? TRANSLATION_LIMIT_MESSAGE : err instanceof Error ? err.message : String(err);
      setTranslations((previous) => ({ ...previous, [index]: { state: "failed", message } }));
    }
  };

  // Hang up if the Learner navigates away mid-Session.
  useEffect(() => () => live.current?.end(), []);

  // Closes the connection, then has the server hang up and settle. Safe to call twice (End, countdown, drop).
  const finish = async () => {
    const session = live.current;
    if (!session || finishing.current) return;
    finishing.current = true;
    setPhase("ending");
    setDraft("");
    unsettled.current = { sessionId: session.sessionId, partnerSeconds: session.partnerSeconds() };
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
      setSummary(await reportEnd(pending.sessionId, pending.partnerSeconds));
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
    setPhase("connecting");
    setSummary(undefined);
    setError(undefined);
    setMicBlocked(false);
    setTurns([]);
    setTranslations({});
    transcriptSession.current = undefined;
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
      transcriptSession.current = live.current.sessionId;
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
          {turns.map((turn, i) => {
            const translation = translations[i];
            // Translations only work while the Session is live; after it ends the Transcript is plain text.
            const tappable = turn.speaker === "Partner" && phase === "live";
            return (
              <li key={i}>
                <b>{turn.speaker === "Partner" ? "Partner" : "You"}:</b>{" "}
                {tappable ? (
                  <button type="button" className="turn" onClick={() => void showTranslation(i, turn.text)}>
                    {turn.text}
                  </button>
                ) : (
                  turn.text
                )}
                {translation?.state === "loading" && <div className="muted">Translating…</div>}
                {translation?.state === "done" && <div className="translation">{translation.text}</div>}
                {translation?.state === "failed" && (
                  <div role="alert">
                    <span className="dot bad" /> {translation.message}
                  </div>
                )}
              </li>
            );
          })}
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
