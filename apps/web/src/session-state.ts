// The Session screen's state: a pure reducer, no I/O. The session client passes on realtime events;
// the screen adds Learner actions and the outcome of Turn translation requests.
import type { TurnSpeaker } from "./session-client.ts";

export type PartnerState = "speaking" | "listening" | "thinking";

/**
 * Which realtime event moves the Partner state where, in one place so a renamed event is a one-line fix.
 * Names are from OpenAI's Realtime API over WebRTC: `output_audio_buffer.*` is sent only on WebRTC connections.
 */
export const PARTNER_STATE_BY_REALTIME_EVENT: Readonly<Record<string, PartnerState>> = {
  // Partner audio starts playing.
  "output_audio_buffer.started": "speaking",
  // Partner audio stops (finished, or cut off by the Learner talking over it).
  "output_audio_buffer.stopped": "listening",
  "output_audio_buffer.cleared": "listening",
  // A response finishes. Audio is generated faster than it plays, so this usually arrives mid-speech:
  // see `YIELDS_TO_SPEAKING`.
  "response.done": "listening",
  // The Learner starts speaking: it's their turn. When they stop, a reply is coming.
  "input_audio_buffer.speech_started": "listening",
  "input_audio_buffer.speech_stopped": "thinking",
};

/** Events that must not end Speaking: playback finishing (`output_audio_buffer.stopped`) does that instead. */
const YIELDS_TO_SPEAKING: ReadonlySet<string> = new Set(["response.done"]);

export interface Turn {
  speaker: TurnSpeaker;
  text: string;
}

/** A Partner Turn's Turn translation. `open` is whether the Learner has it showing; the text is kept once fetched. */
export interface TurnTranslationState {
  open: boolean;
  status: "loading" | "done" | "failed";
  text?: string;
  message?: string;
}

export interface SessionState {
  partner: PartnerState;
  turns: Turn[];
  /** The Partner's Turn so far, while it is still being spoken. */
  draft: string;
  /** By Turn index. A Turn with no entry has never been asked for. */
  translations: Record<number, TurnTranslationState>;
}

export type SessionEvent =
  | { kind: "reset" }
  | { kind: "realtime"; type: string }
  | { kind: "partner-draft"; text: string }
  | { kind: "turn"; speaker: TurnSpeaker; text: string }
  | { kind: "toggle-translation"; index: number }
  | { kind: "translation-arrived"; index: number; text: string }
  | { kind: "translation-failed"; index: number; message: string };

/** Before the first event the Partner state is thinking: the Partner opens the Session. */
export const initialSessionState: SessionState = { partner: "thinking", turns: [], draft: "", translations: {} };

/** Whether tapping this Turn needs a translation request: it was never asked for, or the last try failed. */
export const needsTranslation = (state: SessionState, index: number) => {
  const translation = state.translations[index];
  return !translation || translation.status === "failed";
};

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (event.kind) {
    case "reset":
      return initialSessionState;
    case "realtime": {
      const partner = PARTNER_STATE_BY_REALTIME_EVENT[event.type];
      if (!partner || partner === state.partner) return state;
      if (state.partner === "speaking" && YIELDS_TO_SPEAKING.has(event.type)) return state;
      return { ...state, partner };
    }
    case "partner-draft":
      return { ...state, draft: event.text };
    case "turn":
      return {
        ...state,
        turns: [...state.turns, { speaker: event.speaker, text: event.text }],
        draft: event.speaker === "Partner" ? "" : state.draft,
      };
    case "toggle-translation": {
      const translation = state.translations[event.index];
      const next: TurnTranslationState =
        !translation || translation.status === "failed"
          ? { open: true, status: "loading" }
          : { ...translation, open: !translation.open };
      return { ...state, translations: { ...state.translations, [event.index]: next } };
    }
    case "translation-arrived":
      return setTranslation(state, event.index, { status: "done", text: event.text });
    case "translation-failed":
      return setTranslation(state, event.index, { status: "failed", message: event.message });
  }
}

function setTranslation(state: SessionState, index: number, result: Partial<TurnTranslationState>): SessionState {
  const current = state.translations[index];
  if (!current) return state;
  return { ...state, translations: { ...state.translations, [index]: { ...current, ...result } } };
}
