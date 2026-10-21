import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { productionOutsideWorld, type OutsideWorld } from "./outside-world.ts";

export interface Deps {
  db: DynamoDBDocumentClient;
  tableName: string;
  stage: string;
  world: OutsideWorld;
  /** Sessions were admins-only until #12 opened Immersr to all Learners (the stack sets SESSIONS_OPEN_TO_ALL=true). */
  sessionsAdminsOnly: boolean;
}

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
};

export function productionDeps(): Deps {
  return {
    db: DynamoDBDocumentClient.from(new DynamoDBClient({})),
    tableName: requireEnv("TABLE_NAME"),
    stage: requireEnv("STAGE"),
    world: productionOutsideWorld(),
    sessionsAdminsOnly: process.env.SESSIONS_OPEN_TO_ALL !== "true",
  };
}
