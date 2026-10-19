import { productionDeps } from "../lib/deps.ts";
import { hangUp } from "../routes/hang-up.ts";

export const handler = hangUp(productionDeps());
