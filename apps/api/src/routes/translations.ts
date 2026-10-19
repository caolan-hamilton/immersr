import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { TranslateRequest, type TranslateResponse } from "@immersr/shared";
import type { Deps } from "../lib/deps.ts";
import { json } from "../lib/http.ts";
import { callerOf } from "../lib/learner.ts";
import { getSession, releaseTranslation, takeTranslation } from "../lib/metering.ts";

// POST /api/translations: the Turn translation of one Partner Turn, for the Learner's own active Session.
// Each Learner gets a limited number a day, counted before the paid call so the limit can't be raced past.
export const translate =
  (deps: Deps) =>
  async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyStructuredResultV2> => {
    const { sub } = callerOf(event);

    let raw: unknown;
    try {
      raw = JSON.parse(event.body ?? "");
    } catch {
      return json(400, { error: "Request body must be JSON." });
    }
    const parsed = TranslateRequest.safeParse(raw);
    if (!parsed.success) return json(400, { error: "Invalid request." });
    const { sessionId, text } = parsed.data;

    // Keyed by the caller's own sub, so another Learner's Session is simply not found.
    const session = await getSession(deps, sub, sessionId);
    if (!session || session.status !== "active") {
      return json(409, { error: "Translations are only available during your own active Session." });
    }

    const now = deps.world.clock.now();
    if (!(await takeTranslation(deps, sub, now))) {
      return json(429, { error: "You've reached today's translation limit." });
    }

    try {
      const body: TranslateResponse = { translation: await deps.world.translate.toEnglish(text, session.language) };
      return json(200, body);
    } catch (err) {
      console.error("Translating failed", err);
      // A translation that failed shouldn't use up the Learner's limit.
      await releaseTranslation(deps, sub, now).catch((releaseErr: unknown) =>
        console.error("Returning the translation to the daily limit failed", releaseErr),
      );
      return json(502, { error: "Couldn't translate that. Please try again." });
    }
  };
