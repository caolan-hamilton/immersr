import { describe, expect, it } from "vitest";
import { pauseEvents, RESUME_AFTER_CUT_OFF } from "./realtime-pause.ts";

const types = (events: object[]) => events.map((e) => (e as { type: string }).type);

describe("pauseEvents", () => {
  it("cancels the reply and drops unplayed audio when Pause cuts the Partner off", () => {
    expect(types(pauseEvents(true, true))).toEqual(["response.cancel", "output_audio_buffer.clear"]);
  });

  it("only cancels when the Partner wasn't speaking", () => {
    expect(types(pauseEvents(true, false))).toEqual(["response.cancel"]);
  });

  it("on Resume after a cut-off, tells the Partner to finish its sentence, then asks it to carry on", () => {
    const events = pauseEvents(false, true);
    expect(types(events)).toEqual(["conversation.item.create", "response.create"]);
    expect(events[0]).toMatchObject({
      item: { type: "message", role: "system", content: [{ type: "input_text", text: RESUME_AFTER_CUT_OFF }] },
    });
  });

  it("on Resume otherwise, just asks the Partner to carry on", () => {
    expect(types(pauseEvents(false, false))).toEqual(["response.create"]);
  });
});
