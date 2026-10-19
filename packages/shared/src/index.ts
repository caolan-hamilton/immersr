// Request and response shapes shared by the web app and the API.
import { z } from "zod";

export const HealthResponse = z.object({
  status: z.literal("ok"),
  stage: z.string(),
  time: z.iso.datetime(),
  db: z.literal("ok"),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
