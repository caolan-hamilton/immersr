import { LANGUAGES, LEVELS, LEVEL_HINTS, LEVEL_NAMES, TOPIC_MAX_LENGTH, type Language, type Level } from "@immersr/shared";
import { Blob } from "./Blob.tsx";
import { formatDuration } from "./format.ts";
import { TopBar, type NavScreen } from "./Nav.tsx";
import { Scene } from "./Scenes.tsx";
import { THEMES } from "./themes.ts";

export const TOPIC_SUGGESTIONS = ["your weekend", "food", "travel", "sport", "a film you liked", "your job"];

const FORM_ID = "new-session";

interface SetupProps {
  language: Language;
  onLanguageChange(language: Language): void;
  level: Level;
  onLevelChange(level: Level): void;
  topic: string;
  onTopicChange(topic: string): void;
  remainingSeconds: number;
  streak: number;
  /** Why the last start was refused, shown above the button. The choices above are kept. */
  error?: string;
  /** Set when the microphone is blocked, with its own instructions. */
  micBlocked?: boolean;
  onNavigate(screen: NavScreen): void;
  onBack(): void;
  onStart(): void;
}

/**
 * The Setup screen. On a phone, one column with Start talking at the bottom. On a wide window, the form on the left and
 * a live preview of the Session on the right, with Start talking beside it. The Start button, notices and time-left hint
 * are rendered once for each layout; only one is ever visible.
 */
export function Setup(props: SetupProps) {
  const { language, level, topic, error } = props;
  const theme = THEMES[language];
  const notices = (
    <>
      {props.micBlocked && (
        <p role="alert" className="chunk px-3.5 py-3 text-sm font-medium">
          <span className="dot bad" /> Immersr can't use your microphone. Click the lock or camera icon in your
          browser's address bar, set Microphone to Allow, then reload this page and press Start talking again.
        </p>
      )}
      {error && (
        <p role="alert" className="chunk px-3.5 py-3 text-sm font-medium">
          <span className="dot bad" /> {error}
        </p>
      )}
    </>
  );
  const timeLeft = `Up to 15 minutes · ${formatDuration(props.remainingSeconds)} left today`;
  return (
    <div className="flex grow flex-col">
      <header className="flex items-center justify-between border-b-[3px] border-line bg-body px-5 py-[18px] text-on-body desk:hidden">
        <span className="font-display text-[26px] font-black">Immersr</span>
      </header>
      <TopBar current="home" go={props.onNavigate} streak={props.streak} />
      <div className="flex grow flex-col gap-[18px] px-5 pb-5 pt-[18px] desk:mx-auto desk:w-full desk:max-w-[1120px] desk:grow-0 desk:gap-5 desk:px-8 desk:pb-12 desk:pt-8">
        <button type="button" className="min-h-11 self-start font-bold" onClick={props.onBack}>
          ← Home
        </button>
        <h1 className="font-display text-[30px] font-black desk:text-[40px]">New Session</h1>
        <div className="flex grow flex-col gap-[18px] desk:grow-0 desk:grid desk:grid-cols-[minmax(0,1fr)_360px] desk:items-start desk:gap-7">
          <form
            id={FORM_ID}
            className="flex grow flex-col gap-[18px] desk:grow-0 desk:gap-[22px] desk:rounded-[20px] desk:border-[3px] desk:border-line desk:bg-card desk:p-6 desk:shadow-chunk"
            onSubmit={(e) => {
              e.preventDefault();
              props.onStart();
            }}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-bold">Language</legend>
              <div className="grid grid-cols-3 gap-2.5">
                {LANGUAGES.map((code) => {
                  const tile = THEMES[code];
                  const chosen = code === language;
                  return (
                    <button
                      key={code}
                      type="button"
                      className="pick"
                      aria-pressed={chosen}
                      onClick={() => props.onLanguageChange(code)}
                      style={chosen ? { background: tile.body, color: tile.onBody } : undefined}
                    >
                      {tile.short}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 font-bold">Level</legend>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {LEVELS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    className="pick"
                    aria-pressed={l === level}
                    onClick={() => props.onLevelChange(l)}
                    style={l === level ? { background: theme.body, color: theme.onBody } : undefined}
                  >
                    <span className="block font-bold">{LEVEL_NAMES[l]}</span>
                    <span className="block text-sm font-normal">{LEVEL_HINTS[l]}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-2">
              <label htmlFor="topic" className="font-bold">
                Topic
              </label>
              <div className="flex flex-wrap gap-2">
                {TOPIC_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="pick !px-[11px] !py-[7px] text-sm"
                    aria-pressed={suggestion === topic}
                    onClick={() => props.onTopicChange(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <input
                id="topic"
                className="min-h-11 rounded-[14px] border-[2.5px] border-line bg-card px-3 text-ink"
                maxLength={TOPIC_MAX_LENGTH}
                value={topic}
                onChange={(e) => props.onTopicChange(e.target.value)}
                placeholder="or type your own"
              />
            </div>
            <div className="contents desk:hidden">
              <div className="grow" />
              {notices}
              <p className="text-center text-[13px] text-muted">{timeLeft}</p>
              <button type="submit" className="chunk-btn bg-accent text-white" disabled={!topic.trim()}>
                Start talking
              </button>
            </div>
          </form>
          {/* Wide windows only: a live preview of the Session you're about to start, with its Start button. */}
          <aside aria-label="Session preview" className="chunk hidden flex-col overflow-hidden desk:flex">
            <div className="relative border-b-[3px] border-line">
              <Scene language={language} className="h-[230px]" />
              <div className="absolute inset-x-0 bottom-4 flex justify-center">
                <Blob color={theme.body} mood="idle" size={130} />
              </div>
            </div>
            <div className="flex flex-col gap-2.5 p-[18px]">
              <div className="font-display text-2xl font-black">
                {theme.short} · {LEVEL_NAMES[level]}
              </div>
              <div className="text-[15px]">
                Topic: <b>{topic.trim() || "anything"}</b>
              </div>
              <div className="text-[13px] text-muted">{timeLeft}</div>
              {notices}
              <button type="submit" form={FORM_ID} className="chunk-btn mt-1.5 bg-accent text-white" disabled={!topic.trim()}>
                Start talking
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
