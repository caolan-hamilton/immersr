import { productionDeps } from "../lib/deps.ts";
import { deleteMe } from "../routes/delete-me.ts";

export const handler = deleteMe(productionDeps());
