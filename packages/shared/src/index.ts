// Request and response shapes shared by the web app and the API.
import { z } from "zod";

export * from "./milestones.ts";

export const HealthResponse = z.object({
  status: z.literal("ok"),
  stage: z.string(),
  time: z.iso.datetime(),
  db: z.literal("ok"),
});
export type HealthResponse = z.infer<typeof HealthResponse>;

export const MeResponse = z.object({
  allowance: z.object({
    usedSeconds: z.number().int().nonnegative(),
    limitSeconds: z.number().int().positive(),
    resetsAt: z.iso.datetime(),
  }),
  immersion: z.record(z.string(), z.number().int().nonnegative()),
  /** Consecutive local days with a Session, ending today or yesterday; 0 once a day has been missed. */
  streak: z.number().int().nonnegative(),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const LANGUAGES = ["pt-PT", "es-ES", "fr-FR"] as const;
export const Language = z.enum(LANGUAGES);
export type Language = z.infer<typeof Language>;

export const LEVELS = ["superbeginner", "beginner", "intermediate"] as const;
export const Level = z.enum(LEVELS);
export type Level = z.infer<typeof Level>;

export const LEVEL_NAMES: Record<Level, string> = {
  superbeginner: "Superbeginner",
  beginner: "Beginner",
  intermediate: "Intermediate",
};

export const LEVEL_HINTS: Record<Level, string> = {
  superbeginner: "Just starting: very slow, very simple",
  beginner: "Can follow simple, slow speech",
  intermediate: "Can follow everyday conversation",
};

/**
 * Reads a Level stored before the bands changed (A1–B2), or an unknown one. Old Session items and
 * remembered device choices keep their old strings, so anything that reads one goes through here.
 */
export function levelFromStored(stored: string | null | undefined): Level {
  const current = LEVELS.find((level) => level === stored);
  if (current) return current;
  if (stored === "A1") return "beginner";
  if (stored === "A2" || stored === "B1" || stored === "B2") return "intermediate";
  return "superbeginner";
}

export const TOPIC_MAX_LENGTH = 150;

/** Trims and cuts a Topic to TOPIC_MAX_LENGTH characters (whole characters, never half an emoji). */
export const cutTopic = (topic: string): string => Array.from(topic.trim()).slice(0, TOPIC_MAX_LENGTH).join("").trim();

export const CreateSessionRequest = z.object({
  sdpOffer: z.string().min(1),
  language: Language,
  level: Level,
  topic: z.string().transform(cutTopic).pipe(z.string().min(1)),
  /** The Learner's IANA time zone, which decides the local day for the Streak. Invalid or missing means UTC. */
  timeZone: z.string().optional(),
});
export type CreateSessionRequest = z.infer<typeof CreateSessionRequest>;

export const CreateSessionResponse = z.object({
  sessionId: z.string(),
  sdpAnswer: z.string(),
  endsAt: z.iso.datetime(),
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponse>;

/** Auth settings the web app needs at runtime; served as /config.json so one build works for every stage. */
export const WebConfig = z.object({
  cognitoDomain: z.string(),
  clientId: z.string(),
});
export type WebConfig = z.infer<typeof WebConfig>;

/** Why a Session was refused with 429: the Learner's own Daily allowance, or the app-wide cap. */
export const SessionRefusal = z.object({ reason: z.enum(["daily-allowance", "global-cap"]) });
export type SessionRefusal = z.infer<typeof SessionRefusal>;

export const EndSessionRequest = z.object({
  /** Seconds the Partner spoke, as the browser counted them. Untrusted: the server caps it. */
  partnerSeconds: z.number().int().nonnegative(),
});
export type EndSessionRequest = z.infer<typeof EndSessionRequest>;

export const EndSessionResponse = z.object({
  chargedSeconds: z.number().int().nonnegative(),
  immersionSeconds: z.number().int().nonnegative(),
  /** The Reservation minus what was charged: the time handed back to today's Daily allowance. */
  returnedSeconds: z.number().int().nonnegative(),
});
export type EndSessionResponse = z.infer<typeof EndSessionResponse>;

export const TRANSLATION_MAX_LENGTH = 500;

export const TranslateRequest = z.object({
  sessionId: z.string().min(1),
  text: z.string().trim().min(1).max(TRANSLATION_MAX_LENGTH),
});
export type TranslateRequest = z.infer<typeof TranslateRequest>;

export const TranslateResponse = z.object({ translation: z.string() });
export type TranslateResponse = z.infer<typeof TranslateResponse>;
