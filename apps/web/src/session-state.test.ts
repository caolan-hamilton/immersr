import { describe, expect, it } from "vitest";
import { initialSessionState, needsTranslation, sessionReducer, type SessionEvent, type SessionState } from "./session-state.ts";

const run = (events: SessionEvent[], from: SessionState = initialSessionState) => events.reduce(sessionReducer, from);
const realtime = (type: string): SessionEvent => ({ kind: "realtime", type });

describe("Partner state", () => {
  it("starts as thinking, because the Partner opens the Session", () => {
    expect(initialSessionState.partner).toBe("thinking");
  });

  it.each([
    ["output_audio_buffer.started", "speaking"],
    ["output_audio_buffer.stopped", "listening"],
    ["output_audio_buffer.cleared", "listening"],
    ["response.done", "listening"],
    ["input_audio_buffer.speech_started", "listening"],
    ["input_audio_buffer.speech_stopped", "thinking"],
  ] as const)("%s → %s", (type, expected) => {
    const from: SessionState = { ...initialSessionState, partner: expected === "speaking" ? "listening" : "speaking" };
    expect(run([realtime(type)], from).partner).toBe(expected);
  });

  it("goes through the full cycle: Learner stops → thinking → Partner audio → speaking", () => {
    const types = ["input_audio_buffer.speech_started", "input_audio_buffer.speech_stopped", "output_audio_buffer.started"];
    const states = types.map((_, i) => run(types.slice(0, i + 1).map(realtime)).partner);
    expect(states).toEqual(["listening", "thinking", "speaking"]);
  });

  it("stays thinking after the Learner stops until Partner audio starts", () => {
    expect(run([realtime("input_audio_buffer.speech_stopped"), realtime("response.created")]).partner).toBe("thinking");
  });

  it("ignores events it doesn't know", () => {
    const state = run([realtime("output_audio_buffer.started")]);
    expect(run([realtime("session.updated")], state)).toBe(state);
  });
});

describe("Transcript", () => {
  it("shows the Partner's draft, then turns it into a Turn", () => {
    const drafting = run([{ kind: "partner-draft", text: "Olá, como" }]);
    expect(drafting.draft).toBe("Olá, como");
    expect(drafting.turns).toEqual([]);
    const done = run([{ kind: "turn", speaker: "Partner", text: "Olá, como estás?" }], drafting);
    expect(done.draft).toBe("");
    expect(done.turns).toEqual([{ speaker: "Partner", text: "Olá, como estás?" }]);
  });

  it("adds Learner Turns in order without disturbing the Partner's draft", () => {
    const state = run([
      { kind: "partner-draft", text: "Bom" },
      { kind: "turn", speaker: "Learner", text: "Hello" },
    ]);
    expect(state.turns).toEqual([{ speaker: "Learner", text: "Hello" }]);
    expect(state.draft).toBe("Bom");
  });
});

describe("Turn translation", () => {
  const withTurn = run([{ kind: "turn", speaker: "Partner", text: "Bom dia" }]);
  const toggle: SessionEvent = { kind: "toggle-translation", index: 0 };

  it("opens and asks on the first tap, shows the arrived text, then toggles without asking again", () => {
    expect(needsTranslation(withTurn, 0)).toBe(true);
    const asked = run([toggle], withTurn);
    expect(asked.translations[0]).toEqual({ open: true, status: "loading" });
    const arrived = run([{ kind: "translation-arrived", index: 0, text: "Good morning" }], asked);
    expect(arrived.translations[0]).toEqual({ open: true, status: "done", text: "Good morning" });
    const closed = run([toggle], arrived);
    expect(closed.translations[0]?.open).toBe(false);
    expect(needsTranslation(closed, 0)).toBe(false);
    expect(run([toggle], closed).translations[0]).toEqual({ open: true, status: "done", text: "Good morning" });
  });

  it("records a failure, and the next tap tries again", () => {
    const failed = run([toggle, { kind: "translation-failed", index: 0, message: "Nope" }], withTurn);
    expect(failed.translations[0]).toMatchObject({ status: "failed", message: "Nope" });
    expect(needsTranslation(failed, 0)).toBe(true);
    expect(run([toggle], failed).translations[0]).toEqual({ open: true, status: "loading" });
  });

  it("keeps a translation that arrives after the Learner closed it closed", () => {
    const state = run([toggle, toggle, { kind: "translation-arrived", index: 0, text: "Good morning" }], withTurn);
    expect(state.translations[0]).toMatchObject({ open: false, status: "done" });
  });

  it("keeps each Turn's translation separate", () => {
    expect(run([{ kind: "toggle-translation", index: 1 }], withTurn).translations[0]).toBeUndefined();
  });
});
