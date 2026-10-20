// What Pause and Resume send to the Partner over the data channel.

/**
 * Added to the conversation on Resume when Pause cut the Partner off mid-Turn. It is a system message,
 * not response instructions, so the Session's own instructions (Target language only, Level, Topic) still apply.
 */
export const RESUME_AFTER_CUT_OFF =
  "The Learner paused the conversation while you were speaking and has now resumed. Your last message was cut off " +
  "where the Learner stopped hearing it. Pick up from there: repeat the last few words you said, then finish that " +
  "sentence and carry on as before. Don't greet the Learner again or start a new topic.";

/**
 * The client events to send when the Learner pauses or resumes.
 * `cutOff` is whether the Partner was speaking when the Learner paused.
 */
export function pauseEvents(paused: boolean, cutOff: boolean): object[] {
  if (paused) {
    // Stop the reply. If the Partner was speaking, also drop its unplayed audio, so the server trims
    // the Partner's message to what the Learner actually heard.
    return cutOff ? [{ type: "response.cancel" }, { type: "output_audio_buffer.clear" }] : [{ type: "response.cancel" }];
  }
  const carryOn = { type: "response.create" };
  if (!cutOff) return [carryOn];
  return [
    {
      type: "conversation.item.create",
      item: { type: "message", role: "system", content: [{ type: "input_text", text: RESUME_AFTER_CUT_OFF }] },
    },
    carryOn,
  ];
}
