import { productionDeps } from "../lib/deps.ts";
import { createSession } from "../routes/sessions.ts";

export const handler = createSession(productionDeps());
