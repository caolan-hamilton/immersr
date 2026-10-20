import { crossedMilestone, nextMilestone, type EndSessionResponse, type Language } from "@immersr/shared";
import { Blob } from "./Blob.tsx";
import { formatDuration } from "./format.ts";
import { Scene } from "./Scenes.tsx";
import { THEMES } from "./themes.ts";

interface SummaryProps {
  language: Language;
  result: EndSessionResponse;
  /** Immersion time in this Target language before the Session, in seconds. */
  beforeSeconds: number;
  onBackToHome(): void;
}

/** The Summary screen: what the Session gave, and what went back to today's Daily allowance. */
export function Summary({ language, result, beforeSeconds, onBackToHome }: SummaryProps) {
  const theme = THEMES[language];
  const totalSeconds = beforeSeconds + result.immersionSeconds;
  const crossed = crossedMilestone(beforeSeconds, totalSeconds);
  const { next, fraction } = nextMilestone(totalSeconds);

  return (
    <div className="flex grow flex-col">
      <div className="relative border-b-[3px] border-line">
        <Scene language={language} height={260} />
        <div className="absolute inset-x-0 bottom-5 flex justify-center">
          <Blob color={theme.body} mood="happy" size={140} label="Blob celebrating" />
        </div>
      </div>
      <div className="flex grow flex-col gap-3 p-5">
        <h1 className="font-display text-[30px] font-black">{theme.wellDone}</h1>
        {crossed && (
          <div role="status" className="chunk bg-body px-4 py-3 text-on-body">
            <div className="font-display text-[22px] font-black">
              Milestone reached: {crossed.hours.toLocaleString("en")} h!
            </div>
            <div className="text-sm font-medium">
              That much {theme.short} listening usually means {crossed.description}.
            </div>
          </div>
        )}
        <div className="chunk bg-you px-4 py-3.5 text-[#141414]">
          <div className="font-display text-[30px] font-black">+{formatDuration(result.immersionSeconds)}</div>
          <div className="font-medium">Immersion time added</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="chunk px-3 py-2.5">
            <div className="font-display text-xl font-black">{formatDuration(result.returnedSeconds)}</div>
            <div className="text-[13px]">returned to today's allowance</div>
          </div>
          <div className="chunk px-3 py-2.5">
            <div className="font-display text-xl font-black">{formatDuration(totalSeconds)}</div>
            <div className="text-[13px]">{theme.short} in total</div>
          </div>
        </div>
        <div className="chunk flex flex-col gap-2 px-3.5 py-3">
          {next ? (
            <>
              <div className="text-sm font-bold">Road to {next.hours.toLocaleString("en")} h</div>
              <div
                role="progressbar"
                aria-label={`Progress to ${next.hours.toLocaleString("en")} hours of Immersion time`}
                aria-valuemin={0}
                aria-valuemax={next.hours}
                aria-valuenow={Math.round((totalSeconds / 3600) * 10) / 10}
                className="h-3 rounded-full border-2 border-line bg-track"
              >
                <div className="h-full rounded-full bg-body" style={{ width: `${Math.max(fraction * 100, 2)}%` }} />
              </div>
            </>
          ) : (
            <div className="text-sm font-bold">You've passed every Milestone in {theme.short}. Wonderful!</div>
          )}
        </div>
        <div className="grow" />
        <button type="button" className="chunk-btn bg-accent text-white" onClick={onBackToHome}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
