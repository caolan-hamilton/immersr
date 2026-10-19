import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { HealthResponse } from "@immersr/shared";
import type { Deps } from "../lib/deps.ts";
import { json } from "../lib/http.ts";

// GET /api/health: proves the deployed path web → CloudFront → API → Lambda → DynamoDB.
export const health =
  (deps: Deps) =>
  async (_event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> => {
    await deps.db.send(new GetCommand({ TableName: deps.tableName, Key: { PK: "HEALTH", SK: "HEALTH" } }));
    const body: HealthResponse = {
      status: "ok",
      stage: deps.stage,
      time: deps.world.clock.now().toISOString(),
      db: "ok",
    };
    return json(200, body);
  };
