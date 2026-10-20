import { LEVEL_NAMES, type Language, type Level } from "@immersr/shared";
import { useEffect, useRef } from "react";
import { Blob } from "./Blob.tsx";
import { formatCountdown } from "./format.ts";
import { Scene } from "./Scenes.tsx";
import type { SessionState, PartnerState } from "./session-state.ts";
import { THEMES } from "./themes.ts";

const PARTNER_LABEL: Record<PartnerState, string> = {
  speaking: "Speaking…",
  listening: "Listening…",
  thinking: "Thinking…",
};

interface LiveSessionProps {
  language: Language;
  level: Level;
  topic: string;
  secondsLeft: number;
  state: SessionState;
  onToggleTranslation(index: number): void;
  onToggleMute(): void;
  onPause(): void;
  onResume(): void;
  onToggleListeningMode(): void;
  onEnd(): void;
}

/** The Session screen: Blob in the country scene acting out the Partner state, then the Transcript. */
export function LiveSession({ language, level, topic, secondsLeft, state, onToggleTranslation, onToggleMute, onPause, onResume, onToggleListeningMode, onEnd }: LiveSessionProps) {
  const theme = THEMES[language];
  const { partner, turns, draft, translations, muted, paused, listeningMode } = state;
  const partnerLabel = paused ? "Paused" : PARTNER_LABEL[partner];
  // The Transcript follows the newest line, unless the Learner has scrolled up to reread something.
  const transcript = useRef<HTMLUListElement>(null);
  const following = useRef(true);
  useEffect(() => {
    const list = transcript.current;
    if (list && following.current) list.scrollTop = list.scrollHeight;
  }, [turns.length, draft, listeningMode]);
  return (
    // One tree for both layouts, so resizing never remounts it. On a phone the parts stack. On a wide window it is a
    // grid: the scene on the left, the Transcript column on the right (gone in Listening mode), then the controls.
    <div
      className={`flex grow flex-col desk:grid desk:min-h-0 desk:grid-rows-[minmax(0,1fr)_auto_auto] ${
        listeningMode ? "desk:grid-cols-1" : "desk:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
      }`}
    >
      <div className="relative border-b-[3px] border-line desk:col-start-1 desk:row-start-1 desk:min-h-0 desk:overflow-hidden desk:border-b-0">
        <div className="desk:absolute desk:inset-0">
          <Scene language={language} className={`${listeningMode ? "h-[470px]" : "h-[300px]"} desk:h-full`} />
        </div>
        <div className="absolute inset-x-3.5 top-3.5 flex items-start justify-between gap-2 desk:inset-x-[18px] desk:top-[18px]">
          <span className="pill min-w-0 truncate bg-white text-[#141414]">
            {theme.short} · {LEVEL_NAMES[level]} · {topic}
          </span>
          <span
            className="pill shrink-0 bg-you font-display text-base text-[#141414] desk:text-lg"
            role="timer"
            aria-label="Time left in this Session"
          >
            {formatCountdown(secondsLeft)}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
          <Blob
            color={theme.body}
            mood={paused ? "idle" : partner}
            size={listeningMode ? 210 : 150}
            className={listeningMode ? "desk:h-auto desk:w-[300px]" : "desk:h-auto desk:w-[240px]"}
            label={`Blob, the Partner, is ${partnerLabel.replace("…", "").toLowerCase()}`}
          />
          <span className="pill bg-body text-on-body" aria-live="polite">
            {partnerLabel}
          </span>
        </div>
      </div>
      {muted && (
        <p role="status" className="m-0 border-b-[3px] border-line bg-you px-4 py-2 text-sm font-bold text-[#141414] desk:col-span-full desk:row-start-2 desk:border-b-0 desk:border-t-[3px]">
          Your mic is muted. The Partner keeps talking.
        </p>
      )}
      {/* The Transcript column. On a phone it has no box of its own: its parts sit in the page flow. */}
      <div
        className={`contents ${listeningMode ? "desk:hidden" : "desk:col-start-2 desk:row-start-1 desk:flex desk:min-h-0 desk:flex-col desk:border-l-[3px] desk:border-line"}`}
      >
        <div className="hidden items-baseline justify-between border-b-[3px] border-line bg-card px-5 py-3.5 desk:flex">
          <span className="font-display text-xl font-black">Transcript</span>
          <span className="text-[13px] text-muted">Click a line to translate it</span>
        </div>
        {listeningMode ? (
          <p className="m-auto px-4 py-6 text-center text-[15px] text-muted">Listening mode: no Transcript, just listen.</p>
        ) : (
          <ul
            ref={transcript}
            onScroll={(e) => {
              const list = e.currentTarget;
              following.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
            }}
            className="m-0 flex max-h-[330px] grow list-none flex-col gap-2.5 overflow-y-auto p-0 px-4 py-3.5 desk:max-h-none desk:min-h-0 desk:gap-3 desk:p-5"
            aria-label="Transcript"
          >
            {turns.map((turn, i) => {
              if (turn.speaker === "Learner") {
                return (
                  <li key={i} className="chunk max-w-[78%] self-end bg-you px-3 py-2.5 text-[15px] text-[#141414] desk:text-base">
                    {turn.text}
                  </li>
                );
              }
              const translation = translations[i];
              return (
                <li key={i} className="desk:max-w-[88%]">
                  <button
                    type="button"
                    className="chunk flex min-h-11 w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left font-[inherit] text-ink"
                    aria-expanded={translation?.open ?? false}
                    onClick={() => onToggleTranslation(i)}
                  >
                    <span className="text-[15px] leading-snug desk:text-base">{turn.text}</span>
                    {translation?.open && translation.status === "loading" && <span className="text-[13px] text-muted">Translating…</span>}
                    {translation?.open && translation.status === "done" && <span className="text-[13px] text-muted">{translation.text}</span>}
                    {translation?.open && translation.status === "failed" && (
                      <span role="alert" className="text-[13px] text-bad">
                        {translation.message} <span className="desk:hidden">Tap</span>
                        <span className="hidden desk:inline">Click</span> to try again.
                      </span>
                    )}
                    {!translation?.open && (
                      <span className="text-xs text-muted">
                        <span className="desk:hidden">Tap to translate</span>
                        <span className="hidden desk:inline">Click to translate</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            {draft && (
              <li className="chunk px-3 py-2.5 text-[15px] leading-snug text-muted desk:text-base">{draft}</li>
            )}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2 border-t-[3px] border-line bg-card px-3.5 pb-[22px] pt-3 desk:col-span-full desk:row-start-3 desk:gap-3 desk:px-6 desk:py-3.5">
        <button
          type="button"
          className="icon-btn"
          aria-label={muted ? "Unmute your microphone" : "Mute your microphone"}
          aria-pressed={muted}
          onClick={onToggleMute}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            {muted && <path d="M4 4l16 16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
          </svg>
        </button>
        <button type="button" className="icon-btn" aria-label="Pause the Session" onClick={onPause}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
        <button type="button" className="icon-btn" aria-label="Listening mode" aria-pressed={listeningMode} onClick={onToggleListeningMode}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="3" y="14" width="5" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="16" y="14" width="5" height="7" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <button type="button" className="chunk-btn grow bg-accent text-white desk:ml-auto desk:min-w-[200px] desk:grow-0" onClick={onEnd}>
          End
        </button>
      </div>
      {paused && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="paused-title"
          className="fixed inset-0 z-10 flex items-center justify-center bg-[rgba(20,20,20,0.55)] p-6"
        >
          <div className="chunk flex w-full max-w-sm flex-col gap-3 p-5">
            <h2 id="paused-title" className="m-0 font-display text-2xl font-black">
              Paused
            </h2>
            <p className="m-0">
              Session time keeps running while paused. For a long break, End and start again later: unused time is returned.
            </p>
            <button type="button" autoFocus className="chunk-btn w-full bg-body text-on-body" onClick={onResume}>
              Resume
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
