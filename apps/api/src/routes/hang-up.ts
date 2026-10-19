import type { Deps } from "../lib/deps.ts";
import type { HangupTarget } from "../lib/outside-world.ts";
import { getSession, settle } from "../lib/metering.ts";

// Fired by the Session's one-time schedule at the maximum Session length: hangs up and settles as `timed-out`,
// charging the full Reservation (ADR 0004). Covers a Learner who closed the tab or never came back.
export const hangUp =
  (deps: Deps) =>
  async ({ sub, sessionId, callId }: HangupTarget): Promise<void> => {
    const session = await getSession(deps, sub, sessionId);
    // Already settled (End got there first), or gone (account deleted): nothing to change.
    if (!session || session.status !== "active") return;

    // A failure throws so the scheduler retries; settling without a hang-up could leave the call running.
    await deps.world.openai.hangup(session.callId ?? callId);
    await settle(deps, sub, session, "timed-out", 0);
  };
