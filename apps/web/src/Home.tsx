import { LANGUAGES, nextMilestone, type Language, type MeResponse } from "@immersr/shared";
import { Blob } from "./Blob.tsx";
import { formatDuration, formatTimeOfDay } from "./format.ts";
import { THEMES } from "./themes.ts";

interface HomeProps {
  me: MeResponse;
  language: Language;
  onLanguageChange(language: Language): void;
  onStartSession(): void;
}

const hoursLabel = (seconds: number) => `${Math.round((seconds / 3600) * 10) / 10} h`;

export function Home({ me, language, onLanguageChange, onStartSession }: HomeProps) {
  const theme = THEMES[language];
  const { allowance, immersion } = me;
  const remaining = Math.max(0, allowance.limitSeconds - allowance.usedSeconds);
  const seconds = immersion[language] ?? 0;
  const { next, fraction } = nextMilestone(seconds);

  return (
    <div className="flex grow flex-col">
      <header className="flex items-center justify-between border-b-[3px] border-line bg-body px-5 py-[18px] text-on-body">
        <span className="font-display text-[26px] font-black">Immersr</span>
        <span className="flex items-center gap-1.5 rounded-full border-[2.5px] border-line bg-you px-3 py-[5px] text-[13px] font-bold text-[#141414] shadow-chunk-sm">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5 0-3 0-6 0-9z"
              fill="#E8641E"
              stroke="#141414"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          {me.streak === 0 ? "No streak yet" : `${me.streak}-day streak`}
        </span>
      </header>
      <div className="flex grow flex-col gap-3.5 px-5 pt-[18px]">
        <div className="chunk flex items-center gap-3 px-3.5 py-3">
          <Blob color={theme.body} mood="happy" size={92} />
          <div>
            <h2 className="font-display text-[26px] font-black">{theme.hello}</h2>
            <p className="text-[15px]">Ready for today's chat in {theme.short}?</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="chunk bg-you px-3 py-2.5 text-[#141414]">
            <div className="font-display text-[22px] font-black">
              {formatDuration(seconds)}
            </div>
            <div className="text-[13px] font-medium">{theme.short} Immersion time</div>
          </div>
          <div className="chunk px-3 py-2.5">
            <div className="font-display text-[22px] font-black">{formatDuration(remaining)}</div>
            <div className="text-[13px] font-medium">left today · resets {formatTimeOfDay(allowance.resetsAt)}</div>
          </div>
        </div>
        <div className="chunk flex flex-col gap-2 px-3.5 py-3">
          {next ? (
            <>
              <div className="text-sm font-bold">
                Road to {next.hours.toLocaleString("en")} h · {next.description}
              </div>
              <div
                role="progressbar"
                aria-label={`Progress to ${next.hours.toLocaleString("en")} hours of Immersion time`}
                aria-valuemin={0}
                aria-valuemax={next.hours}
                aria-valuenow={Math.round((seconds / 3600) * 10) / 10}
                className="h-3 rounded-full border-2 border-line bg-track"
              >
                <div className="h-full rounded-full bg-body" style={{ width: `${Math.max(fraction * 100, 2)}%` }} />
              </div>
              <div className="flex justify-between text-xs font-medium text-muted">
                <span>0 h</span>
                <span>You: {hoursLabel(seconds)}</span>
                <span>{next.hours.toLocaleString("en")} h</span>
              </div>
            </>
          ) : (
            <div className="text-sm font-bold">You've passed every Milestone in {theme.short}. Wonderful!</div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2.5" role="group" aria-label="Target language">
          {LANGUAGES.map((code) => {
            const tile = THEMES[code];
            const tileSeconds = immersion[code] ?? 0;
            return (
              <button
                key={code}
                type="button"
                className="pick text-left"
                aria-pressed={code === language}
                onClick={() => onLanguageChange(code)}
                style={{
                  background: tile.body,
                  color: tile.onBody,
                  outline: code === language ? "3px solid var(--you)" : undefined,
                  outlineOffset: 2,
                }}
              >
                <div className="text-[13px]">{tile.short}</div>
                <div className="text-xs font-medium">{tileSeconds === 0 ? "Start" : formatDuration(tileSeconds)}</div>
              </button>
            );
          })}
        </div>
        <div className="grow" />
        <button type="button" className="chunk-btn mb-4 bg-accent text-white" onClick={onStartSession}>
          Start a Session
        </button>
      </div>
    </div>
  );
}
