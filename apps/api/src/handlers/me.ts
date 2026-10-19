import { productionDeps } from "../lib/deps.ts";
import { me } from "../routes/me.ts";

export const handler = me(productionDeps());
