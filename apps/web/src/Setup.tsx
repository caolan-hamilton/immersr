import { LANGUAGES, LEVELS, TOPIC_MAX_LENGTH, type Language, type Level } from "@immersr/shared";
import { formatDuration } from "./format.ts";
import { THEMES } from "./themes.ts";

export const TOPIC_SUGGESTIONS = ["your weekend", "food", "travel", "sport", "a film you liked", "your job"];

interface SetupProps {
  language: Language;
  onLanguageChange(language: Language): void;
  level: Level;
  onLevelChange(level: Level): void;
  topic: string;
  onTopicChange(topic: string): void;
  remainingSeconds: number;
  /** Why the last start was refused, shown above the button. The choices above are kept. */
  error?: string;
  /** Set when the microphone is blocked, with its own instructions. */
  micBlocked?: boolean;
  onBack(): void;
  onStart(): void;
}

export function Setup(props: SetupProps) {
  const { language, level, topic, error } = props;
  const theme = THEMES[language];
  return (
    <div className="flex grow flex-col">
      <header className="flex items-center justify-between border-b-[3px] border-line bg-body px-5 py-[18px] text-on-body">
        <span className="font-display text-[26px] font-black">Immersr</span>
      </header>
      <form
        className="flex grow flex-col gap-[18px] px-5 pb-5 pt-[18px]"
        onSubmit={(e) => {
          e.preventDefault();
          props.onStart();
        }}
      >
        <button type="button" className="min-h-11 self-start font-bold" onClick={props.onBack}>
          ← Home
        </button>
        <h1 className="font-display text-[30px] font-black">New Session</h1>
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
          <div className="grid grid-cols-4 gap-2.5">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                className="pick"
                aria-pressed={l === level}
                onClick={() => props.onLevelChange(l)}
                style={l === level ? { background: theme.body, color: theme.onBody } : undefined}
              >
                {l}
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
        <div className="grow" />
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
        <p className="text-center text-[13px] text-muted">
          Up to 15 minutes · {formatDuration(props.remainingSeconds)} left today
        </p>
        <button type="submit" className="chunk-btn bg-accent text-white" disabled={!topic.trim()}>
          Start talking
        </button>
      </form>
    </div>
  );
}
