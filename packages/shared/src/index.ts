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

/** Auth settings the web app needs at runtime; served as /config.json so one build works for every stage. */
export const WebConfig = z.object({
  cognitoDomain: z.string(),
  clientId: z.string(),
});
export type WebConfig = z.infer<typeof WebConfig>;
