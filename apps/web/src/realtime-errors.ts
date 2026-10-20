// Some Realtime `error` events are routine and leave the Session working. Showing them to the Learner
// only alarms them, so they are logged instead.

export interface RealtimeError {
  code?: string;
  message?: string;
}

/** True for a Realtime error that doesn't affect the Session, so the Learner shouldn't see it. */
export function isHarmlessRealtimeError(error: RealtimeError | undefined): boolean {
  if (!error) return false;
  // Over WebRTC, OpenAI cuts the Partner's reply short when the Learner talks over it. When its estimate of
  // how much audio was played overshoots the audio it generated, it reports e.g.
  // "Audio content of 14350ms is already shorter than 17060ms". The reply is already over, so nothing is lost.
  if (/audio content of \d+ms is already shorter than \d+ms/i.test(error.message ?? "")) return true;
  // Pause cancels the current reply; when no reply is in progress there is nothing to cancel.
  if (error.code === "response_cancel_not_active") return true;
  return false;
}
