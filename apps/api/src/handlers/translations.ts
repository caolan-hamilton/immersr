import { productionDeps } from "../lib/deps.ts";
import { translate } from "../routes/translations.ts";

export const handler = translate(productionDeps());
