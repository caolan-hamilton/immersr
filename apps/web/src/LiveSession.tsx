import type { Language, Level } from "@immersr/shared";
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
  onEnd(): void;
}

/** The Session screen: Blob in the country scene acting out the Partner state, then the Transcript. */
export function LiveSession({ language, level, topic, secondsLeft, state, onToggleTranslation, onEnd }: LiveSessionProps) {
  const theme = THEMES[language];
  const { partner, turns, draft, translations } = state;
  return (
    <div className="flex grow flex-col">
      <div className="relative border-b-[3px] border-line">
        <Scene language={language} height={300} />
        <div className="absolute inset-x-3.5 top-3.5 flex items-start justify-between gap-2">
          <span className="pill min-w-0 truncate bg-white text-[#141414]">
            {theme.short} · {level} · {topic}
          </span>
          <span
            className="pill shrink-0 bg-you font-display text-base text-[#141414]"
            role="timer"
            aria-label="Time left in this Session"
          >
            {formatCountdown(secondsLeft)}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
          <Blob color={theme.body} mood={partner} size={150} label={`Blob, the Partner, is ${PARTNER_LABEL[partner].replace("…", "")}`} />
          <span className="pill bg-body text-on-body" aria-live="polite">
            {PARTNER_LABEL[partner]}
          </span>
        </div>
      </div>
      <ul className="m-0 flex max-h-[330px] grow list-none flex-col gap-2.5 overflow-y-auto p-0 px-4 py-3.5" aria-label="Transcript">
        {turns.map((turn, i) => {
          if (turn.speaker === "Learner") {
            return (
              <li key={i} className="chunk max-w-[78%] self-end bg-you px-3 py-2.5 text-[15px] text-[#141414]">
                {turn.text}
              </li>
            );
          }
          const translation = translations[i];
          return (
            <li key={i}>
              <button
                type="button"
                className="chunk flex min-h-11 w-full cursor-pointer flex-col gap-1 px-3 py-2.5 text-left font-[inherit] text-ink"
                aria-expanded={translation?.open ?? false}
                onClick={() => onToggleTranslation(i)}
              >
                <span className="text-[15px] leading-snug">{turn.text}</span>
                {translation?.open && translation.status === "loading" && <span className="text-[13px] text-muted">Translating…</span>}
                {translation?.open && translation.status === "done" && <span className="text-[13px] text-muted">{translation.text}</span>}
                {translation?.open && translation.status === "failed" && (
                  <span role="alert" className="text-[13px] text-bad">
                    {translation.message} Tap to try again.
                  </span>
                )}
                {!translation?.open && <span className="text-xs text-muted">Tap to translate</span>}
              </button>
            </li>
          );
        })}
        {draft && (
          <li className="chunk px-3 py-2.5 text-[15px] leading-snug text-muted">{draft}</li>
        )}
      </ul>
      <div className="border-t-[3px] border-line bg-card px-3.5 pb-[22px] pt-3">
        <button type="button" className="chunk-btn w-full bg-accent text-white" onClick={onEnd}>
          End
        </button>
      </div>
    </div>
  );
}
