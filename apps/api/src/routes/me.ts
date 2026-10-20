import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { MeResponse } from "@immersr/shared";
import type { Deps } from "../lib/deps.ts";
import { json } from "../lib/http.ts";
import { allowanceSeconds, callerOf, localDay, nextUtcMidnight, previousDay, usageDay } from "../lib/learner.ts";
import { STREAK_SORT_KEY } from "../lib/metering.ts";
import { TABLE } from "../lib/table.ts";

const IMMERSION_PREFIX = "IMMERSION#";

// GET /api/me: today's Daily allowance and the Learner's Immersion time per Target language.
export const me =
  (deps: Deps) =>
  async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyStructuredResultV2> => {
    const caller = callerOf(event);
    const { sub } = caller;
    const now = deps.world.clock.now();
    const pk = `LEARNER#${sub}`;

    const [usage, immersionItems, streakItem] = await Promise.all([
      deps.db.send(
        new GetCommand({
          TableName: deps.tableName,
          Key: { [TABLE.partitionKey]: pk, [TABLE.sortKey]: `USAGE#${usageDay(now)}` },
        }),
      ),
      deps.db.send(
        new QueryCommand({
          TableName: deps.tableName,
          KeyConditionExpression: "#pk = :pk AND begins_with(#sk, :prefix)",
          ExpressionAttributeNames: { "#pk": TABLE.partitionKey, "#sk": TABLE.sortKey },
          ExpressionAttributeValues: { ":pk": pk, ":prefix": IMMERSION_PREFIX },
        }),
      ),
      deps.db.send(
        new GetCommand({ TableName: deps.tableName, Key: { [TABLE.partitionKey]: pk, [TABLE.sortKey]: STREAK_SORT_KEY } }),
      ),
    ]);

    // The Streak is alive while the last Session was today or yesterday in the Learner's time zone.
    const today = localDay(now, event.queryStringParameters?.timeZone);
    const lastDay = streakItem.Item?.lastDay;
    const streak = lastDay === today || lastDay === previousDay(today) ? (streakItem.Item?.count ?? 0) : 0;

    const body: MeResponse = {
      allowance: {
        usedSeconds: usage.Item?.reservedSeconds ?? 0,
        limitSeconds: allowanceSeconds(caller),
        resetsAt: nextUtcMidnight(now).toISOString(),
      },
      immersion: Object.fromEntries(
        (immersionItems.Items ?? []).map((item) => [
          String(item[TABLE.sortKey]).slice(IMMERSION_PREFIX.length),
          item.partnerSeconds ?? 0,
        ]),
      ),
      streak,
    };
    return json(200, body);
  };
