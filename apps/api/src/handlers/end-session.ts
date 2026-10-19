import { productionDeps } from "../lib/deps.ts";
import { endSession } from "../routes/end-session.ts";

export const handler = endSession(productionDeps());
