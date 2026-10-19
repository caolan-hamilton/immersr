// Lambda entry point: wires production dependencies into the route.
import { productionDeps } from "../lib/deps.ts";
import { health } from "../routes/health.ts";

export const handler = health(productionDeps());
