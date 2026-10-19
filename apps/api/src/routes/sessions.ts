import { randomUUID } from "node:crypto";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { CreateSessionRequest, type CreateSessionResponse } from "@immersr/shared";
import type { Deps } from "../lib/deps.ts";
import { json } from "../lib/http.ts";
import { buildSessionConfig } from "../lib/instructions.ts";
import { callerOf, usageDay } from "../lib/learner.ts";
import { TABLE } from "../lib/table.ts";

/** Below Lambda's 15 minute limit, so a sideband monitor stays possible (ADR 0004). */
export const MAX_SESSION_SECONDS = 10 * 60;

// POST /api/sessions: broker a Session (ADR 0004). The browser sends its SDP offer; we build the Partner's
// instructions, create the call with OpenAI and return the answer. Admins only until Sessions are metered.
export const createSession =
  (deps: Deps) =>
  async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyStructuredResultV2> => {
    const { sub, isAdmin } = callerOf(event);
    if (!isAdmin) return json(403, { error: "Sessions are not open to everyone yet." });

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
    const { sdpOffer, language, level, topic } = parsed.data;

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

    let call: { sdpAnswer: string; callId: string };
    try {
      call = await deps.world.openai.createCall(sdpOffer, buildSessionConfig({ language, level, topic }));
    } catch (err) {
      console.error("Creating the OpenAI call failed", err);
      return json(502, { error: "Couldn't start the Session. Please try again." });
    }

    const sessionId = randomUUID();
    try {
      await deps.db.send(
        new PutCommand({
          TableName: deps.tableName,
          Item: {
            [TABLE.partitionKey]: `LEARNER#${sub}`,
            [TABLE.sortKey]: `SESSION#${sessionId}`,
            sessionId,
            callId: call.callId,
            status: "active",
            language,
            level,
            topic,
            usageDay: usageDay(now),
            startedAt: now.toISOString(),
            endsAt: endsAt.toISOString(),
          },
        }),
      );
    } catch (err) {
      console.error("Storing the Session failed; hanging up the call", err);
      // Nothing records this call, so nothing else could end it. Best effort: the 502 matters more.
      try {
        await deps.world.openai.hangup(call.callId);
      } catch (hangupErr) {
        console.error(`Hanging up orphaned call ${call.callId} failed`, hangupErr);
      }
      return json(502, { error: "Couldn't start the Session. Please try again." });
    }

    const body: CreateSessionResponse = { sessionId, sdpAnswer: call.sdpAnswer, endsAt: endsAt.toISOString() };
    return json(201, body);
  };
