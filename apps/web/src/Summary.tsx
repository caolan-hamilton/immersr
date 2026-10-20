import { crossedMilestone, nextMilestone, type EndSessionResponse, type Language } from "@immersr/shared";
import { Blob } from "./Blob.tsx";
import { formatDuration } from "./format.ts";
import { Scene } from "./Scenes.tsx";
import { THEMES } from "./themes.ts";

interface SummaryProps {
  language: Language;
  /** Absent while the server is still settling the Session: the Summary then shows as a skeleton. */
  result?: EndSessionResponse;
  /** Set when End couldn't be delivered: the skeleton stays, with this message and a retry. */
  endFailure?: { message: string; onRetry(): void };
  /** Immersion time in this Target language before the Session, in seconds. */
  beforeSeconds: number;
  onBackToHome(): void;
}

/** The Summary screen: what the Session gave, and what went back to today's Daily allowance. */
export function Summary({ language, result, endFailure, beforeSeconds, onBackToHome }: SummaryProps) {
  const theme = THEMES[language];
  const waiting = !result;
  // While waiting, the placeholders shimmer; once End has failed they stay still.
  const busy = waiting && !endFailure;
  const totalSeconds = beforeSeconds + (result?.immersionSeconds ?? 0);
  const crossed = result ? crossedMilestone(beforeSeconds, totalSeconds) : undefined;
  const { next, fraction } = nextMilestone(totalSeconds);

  return (
    <div aria-busy={busy} className="flex grow flex-col desk:grid desk:grid-cols-2">
      {busy && (
        <p role="status" className="sr-only">
          Finishing up your Session…
        </p>
      )}
      <div className="relative border-b-[3px] border-line desk:min-h-[560px] desk:border-b-0 desk:border-r-[3px]">
        <div className="desk:absolute desk:inset-0">
          <Scene language={language} className="h-[260px] desk:h-full" />
        </div>
        <div className="absolute inset-x-0 bottom-5 flex justify-center desk:bottom-[50px]">
          <Blob color={theme.body} mood="happy" size={140} label="Blob celebrating" className="desk:h-auto desk:w-[240px]" />
        </div>
      </div>
      <div className="flex grow flex-col gap-3 p-5 desk:max-w-[560px] desk:grow-0 desk:justify-center desk:gap-4 desk:self-center desk:px-14 desk:py-12">
        <h1 className="font-display text-[30px] font-black desk:text-[56px]">{theme.wellDone}</h1>
        {endFailure && (
          <div role="alert" className="chunk flex flex-col gap-3 border-bad px-4 py-3.5">
            <p className="m-0 font-medium">
              <span className="dot bad" /> {endFailure.message}
            </p>
            <button type="button" className="chunk-btn bg-accent px-6 text-white" onClick={endFailure.onRetry}>
              Retry ending the Session
            </button>
          </div>
        )}
        <div className="chunk bg-you px-4 py-3.5 text-[#141414]">
          <div className="font-display text-[30px] font-black desk:text-[40px]">{result ? `+${formatDuration(result.immersionSeconds)}` : <Bone width="7rem" still={!busy} />}</div>
          <div className="font-medium">Immersion time added</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="chunk px-3 py-2.5">
            <div className="font-display text-xl font-black">{result ? formatDuration(result.returnedSeconds) : <Bone width="4.5rem" still={!busy} />}</div>
            <div className="text-[13px]">returned to today's allowance</div>
          </div>
          <div className="chunk px-3 py-2.5">
            <div className="font-display text-xl font-black">{result ? formatDuration(totalSeconds) : <Bone width="5rem" still={!busy} />}</div>
            <div className="text-[13px]">{theme.short} in total</div>
          </div>
        </div>
        <div className="chunk flex flex-col gap-2 px-3.5 py-3">
          {waiting ? (
            <>
              <div className="text-sm font-bold">
                <Bone width="9rem" still={!busy} />
              </div>
              <div className="h-3 rounded-full border-2 border-line bg-track" aria-hidden="true">
                <div className={`skeleton h-full w-1/3 rounded-full ${busy ? "" : "skeleton--still"}`} />
              </div>
            </>
          ) : next ? (
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
        {/* After the numbers, so the celebration arriving never moves them. */}
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
        <div className="grow desk:hidden" />
        <button
          type="button"
          disabled={waiting}
          className="chunk-btn bg-accent text-white desk:mt-1 desk:self-start desk:px-9"
          onClick={onBackToHome}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

/** A shimmering placeholder that takes the same line height as the text it stands in for. */
function Bone({ width, still }: { width: string; still: boolean }) {
  return (
    <span aria-hidden="true" className={`skeleton inline-block rounded-md align-middle ${still ? "skeleton--still" : ""}`} style={{ width }}>
      &nbsp;
    </span>
  );
}
