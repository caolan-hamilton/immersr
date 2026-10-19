import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { EndSessionRequest, type EndSessionResponse } from "@immersr/shared";
import type { Deps } from "../lib/deps.ts";
import { json } from "../lib/http.ts";
import { callerOf } from "../lib/learner.ts";
import { getSession, settle } from "../lib/metering.ts";

// POST /api/sessions/{id}/end: hang up first, then settle once on the server's clock (ADR 0004, ADR 0006).
export const endSession =
  (deps: Deps) =>
  async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyStructuredResultV2> => {
    const { sub } = callerOf(event);
    const sessionId = event.pathParameters?.id;

    let raw: unknown;
    try {
      raw = JSON.parse(event.body ?? "");
    } catch {
      return json(400, { error: "Request body must be JSON." });
    }
    const parsed = EndSessionRequest.safeParse(raw);
    if (!parsed.success) return json(400, { error: "Invalid request." });

    // Keyed by the caller's own sub, so another Learner's Session is simply not found.
    const session = sessionId ? await getSession(deps, sub, sessionId) : undefined;
    if (!session) return json(404, { error: "Session not found." });

    if (session.status !== "active") {
      const stored: EndSessionResponse = {
        chargedSeconds: session.chargedSeconds ?? 0,
        immersionSeconds: session.immersionSeconds ?? 0,
      };
      return json(200, stored);
    }

    if (session.callId) {
      try {
        await deps.world.openai.hangup(session.callId); // "already ended" counts as success inside hangup
      } catch (err) {
        // Not settling means the full Reservation stays charged; the Learner can retry End.
        console.error(`Hanging up call ${session.callId} failed`, err);
        return json(502, { error: "Couldn't end the Session. Please try again." });
      }
    }

    const result: EndSessionResponse = await settle(deps, sub, session, "ended", parsed.data.partnerSeconds);
    return json(200, result);
  };
