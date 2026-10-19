// Request and response shapes shared by the web app and the API.
import { z } from "zod";

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
});
export type MeResponse = z.infer<typeof MeResponse>;

export const LANGUAGES = ["pt-PT", "es-ES", "fr-FR"] as const;
export const Language = z.enum(LANGUAGES);
export type Language = z.infer<typeof Language>;

export const LEVELS = ["A1", "A2", "B1", "B2"] as const;
export const Level = z.enum(LEVELS);
export type Level = z.infer<typeof Level>;

export const TOPIC_MAX_LENGTH = 150;

export const CreateSessionRequest = z.object({
  sdpOffer: z.string().min(1),
  language: Language,
  level: Level,
  topic: z.string().trim().min(1).max(TOPIC_MAX_LENGTH),
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
