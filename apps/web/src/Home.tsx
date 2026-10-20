import { LANGUAGES, nextMilestone, type Language, type MeResponse } from "@immersr/shared";
import { Blob } from "./Blob.tsx";
import { formatDuration, formatTimeOfDay } from "./format.ts";
import { StreakPill } from "./Nav.tsx";
import { Scene } from "./Scenes.tsx";
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
      <header className="flex items-center justify-between border-b-[3px] border-line bg-body px-5 py-[18px] text-on-body desk:hidden">
        <span className="font-display text-[26px] font-black">Immersr</span>
        <StreakPill streak={me.streak} />
      </header>
      {/* On a wide window the hero card and a column of stats sit side by side, capped in width. */}
      <div className="flex grow flex-col gap-3.5 px-5 pt-[18px] desk:mx-auto desk:grid desk:w-full desk:max-w-[1120px] desk:grow-0 desk:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] desk:items-start desk:gap-7 desk:px-8 desk:pb-12 desk:pt-8">
        <div className="chunk flex items-center gap-3 px-3.5 py-3 desk:hidden">
          <Blob color={theme.body} mood="happy" size={92} />
          <div>
            <h2 className="font-display text-[26px] font-black">{theme.hello}</h2>
            <p className="text-[15px]">Ready for today's chat in {theme.short}?</p>
          </div>
        </div>
        <div className="chunk hidden flex-col overflow-hidden desk:flex">
          <div className="relative border-b-[3px] border-line">
            <Scene language={language} className="h-80" />
            <div className="absolute inset-x-0 bottom-[26px] flex justify-center">
              <Blob color={theme.body} mood="happy" size={170} />
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-6 pb-6 pt-5">
            <h2 className="font-display text-[42px] font-black">{theme.hello}</h2>
            <p className="text-lg">Ready for today's chat in {theme.short}?</p>
            <button type="button" className="chunk-btn mt-2 self-start bg-accent px-9 text-white" onClick={onStartSession}>
              Start a Session
            </button>
          </div>
        </div>
        <div className="contents desk:flex desk:flex-col desk:gap-4">
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
        <div className="contents desk:flex desk:flex-col desk:gap-2.5 desk:rounded-[20px] desk:border-[3px] desk:border-line desk:bg-card desk:p-3.5 desk:shadow-chunk">
          <div className="hidden text-sm font-bold desk:block">Your languages</div>
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
        </div>
        </div>
        <div className="grow desk:hidden" />
        <button type="button" className="chunk-btn mb-4 bg-accent text-white desk:hidden" onClick={onStartSession}>
          Start a Session
        </button>
      </div>
    </div>
  );
}
