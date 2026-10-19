import { useEffect, useRef, useState } from "react";
import { LANGUAGES, LEVELS, TOPIC_MAX_LENGTH, type Language, type Level } from "@immersr/shared";
import { MicrophoneBlockedError, startSession, type LiveSession, type TurnSpeaker } from "./session-client.ts";

interface Turn {
  speaker: TurnSpeaker;
  text: string;
}

type Phase = "setup" | "connecting" | "live";

const languageName = (code: string) => new Intl.DisplayNames(undefined, { type: "language" }).of(code) ?? code;

export function SessionPanel() {
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

  const start = async () => {
    setPhase("connecting");
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
            live.current = undefined;
            setDraft("");
            setError("The connection to the Partner was lost. The Session has ended.");
            setPhase("setup");
          },
        },
      );
      setPhase("live");
    } catch (err) {
      if (err instanceof MicrophoneBlockedError) setMicBlocked(true);
      else setError(err instanceof Error ? err.message : String(err));
      setPhase("setup");
    }
  };

  const end = () => {
    live.current?.end();
    live.current = undefined;
    setDraft("");
    setPhase("setup");
  };

  return (
    <>
      <h2>Talk to the Partner</h2>
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
          <button onClick={end}>End</button>
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
