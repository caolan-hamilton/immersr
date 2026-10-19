// A Session whose End hasn't been delivered yet is kept on the device (ADR 0004), so a dropped connection
// or closed tab still gets its unused time refunded and its Immersion time recorded when the app is next online.
import type { EndSessionResponse } from "@immersr/shared";
import { EndFailedError, reportEnd } from "./session-client.ts";

const KEY = "immersr.pendingEnd";

export interface PendingEnd {
  sessionId: string;
  partnerSeconds: number;
}

export function savePendingEnd(pending: PendingEnd): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending));
  } catch {
    // Storage may be unavailable (private mode, quota); the in-memory retry still works.
  }
}

export function loadPendingEnd(): PendingEnd | undefined {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<PendingEnd> | null;
    if (parsed && typeof parsed.sessionId === "string" && typeof parsed.partnerSeconds === "number") {
      return { sessionId: parsed.sessionId, partnerSeconds: parsed.partnerSeconds };
    }
  } catch {
    // Unreadable entry: treat as none.
  }
  return undefined;
}

export function clearPendingEnd(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Delivers End for a pending Session and clears the saved entry. The server returns the stored result if the
 * Session was already settled (for example by the scheduled hang-up), so that counts as success. A 404 means the
 * Session isn't this Learner's or is gone, so retrying can never succeed: the entry is dropped and undefined
 * returned. Any other failure keeps the entry and throws so it can be retried.
 */
export async function deliverPendingEnd(pending: PendingEnd): Promise<EndSessionResponse | undefined> {
  try {
    const result = await reportEnd(pending.sessionId, pending.partnerSeconds);
    clearPendingEnd();
    return result;
  } catch (err) {
    if (err instanceof EndFailedError && err.status === 404) {
      clearPendingEnd();
      return undefined;
    }
    throw err;
  }
}
