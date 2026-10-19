import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { productionOutsideWorld, type OutsideWorld } from "./outside-world.ts";

export interface Deps {
  db: DynamoDBDocumentClient;
  tableName: string;
  stage: string;
  world: OutsideWorld;
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
  };
}
