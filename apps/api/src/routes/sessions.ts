import { randomUUID } from "node:crypto";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { CreateSessionRequest, type CreateSessionResponse } from "@immersr/shared";
import type { Deps } from "../lib/deps.ts";
import { json } from "../lib/http.ts";
import { buildSessionConfig } from "../lib/instructions.ts";
import { allowanceSeconds, callerOf, localDay } from "../lib/learner.ts";
import { MAX_SESSION_SECONDS } from "../lib/limits.ts";
import { reserve, sessionKey, settle } from "../lib/metering.ts";

// POST /api/sessions: broker a Session (ADR 0004). We build the Partner's instructions, reserve the maximum
// Session length, then forward the browser's SDP offer to OpenAI and return the answer.
export const createSession =
  (deps: Deps) =>
  async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyStructuredResultV2> => {
    const caller = callerOf(event);
    const { sub, isAdmin } = caller;

    // Off in deployed stacks since #12 opened Sessions to all Learners; kept so tests can cover both (Deps.sessionsAdminsOnly).
    // Checked first, so a refused caller triggers no moderation call, Reservation or OpenAI call.
    if (deps.sessionsAdminsOnly && !isAdmin) {
      return json(403, { error: "Sessions aren't open to everyone yet." });
    }

    let raw: unknown;
    try {
      raw = JSON.parse(event.body ?? "");
    } catch {
      return json(400, { error: "Request body must be JSON." });
    }
    const parsed = CreateSessionRequest.safeParse(raw);
    if (!parsed.success) {
      return json(400, { error: "Invalid request.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
    }
    const { sdpOffer, language, level, topic, timeZone } = parsed.data;

    // Before anything is reserved or created, so a flagged Topic changes no usage.
    try {
      if ((await deps.world.openai.moderate(topic)).flagged) {
        return json(422, { error: "That Topic can't be used. Please choose another Topic." });
      }
    } catch (err) {
      // Fail closed: an unchecked Topic must not reach the Partner's instructions.
      console.error("Moderating the Topic failed", err);
      return json(502, { error: "Couldn't start the Session. Please try again." });
    }

    const now = deps.world.clock.now();
    const endsAt = new Date(now.getTime() + MAX_SESSION_SECONDS * 1000);
    const sessionId = randomUUID();

    // Reserve before any call is made: a refused start must never cost us an OpenAI call.
    const reservation = await reserve(deps, {
      sub,
      isAdmin,
      allowanceSeconds: allowanceSeconds(caller),
      session: {
        sessionId,
        language,
        level,
        topic,
        startedAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        localDay: localDay(now, timeZone),
      },
    });
    if (!reservation.ok) return json(429, { reason: reservation.reason });

    const failed = async (message: string, hangUp?: string) => {
      if (hangUp) {
        try {
          await deps.world.openai.hangup(hangUp);
        } catch (hangupErr) {
          console.error(`Hanging up orphaned call ${hangUp} failed`, hangupErr);
        }
      }
      try {
        await settle(deps, sub, reservation.session, "released", 0);
      } catch (releaseErr) {
        // The Reservation stays charged: the Learner loses time, never gains it.
        console.error(`Releasing the Reservation for Session ${sessionId} failed`, releaseErr);
      }
      return json(502, { error: message });
    };

    let call: { sdpAnswer: string; callId: string };
    try {
      call = await deps.world.openai.createCall(sdpOffer, buildSessionConfig({ language, level, topic }));
    } catch (err) {
      console.error("Creating the OpenAI call failed", err);
      return failed("Couldn't start the Session. Please try again.");
    }

    try {
      await deps.db.send(
        new UpdateCommand({
          TableName: deps.tableName,
          Key: sessionKey(sub, sessionId),
          UpdateExpression: "SET callId = :callId",
          ExpressionAttributeValues: { ":callId": call.callId },
        }),
      );
    } catch (err) {
      console.error("Storing the call ID failed; hanging up the call", err);
      // Nothing records this call, so nothing else could end it.
      return failed("Couldn't start the Session. Please try again.", call.callId);
    }

    try {
      await deps.world.scheduler.scheduleHangup({ sub, sessionId, callId: call.callId }, endsAt);
    } catch (err) {
      console.error("Scheduling the hang-up failed; hanging up the call", err);
      // Without a hang-up nothing would bound this Session, so it doesn't start.
      return failed("Couldn't start the Session. Please try again.", call.callId);
    }

    const body: CreateSessionResponse = { sessionId, sdpAnswer: call.sdpAnswer, endsAt: endsAt.toISOString() };
    return json(201, body);
  };
