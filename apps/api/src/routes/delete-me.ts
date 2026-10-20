import { BatchWriteCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import type { Deps } from "../lib/deps.ts";
import { json } from "../lib/http.ts";
import { callerOf } from "../lib/learner.ts";
import { learnerKey, settle, type SessionItem } from "../lib/metering.ts";
import { TABLE } from "../lib/table.ts";

const { partitionKey: PK, sortKey: SK } = TABLE;
const BATCH_SIZE = 25; // DynamoDB's BatchWriteItem limit

type Item = Record<string, unknown>;

/** Every item under the Learner's partition (ADR 0006: erasure is one query). */
async function learnerItems(deps: Deps, sub: string): Promise<Item[]> {
  const items: Item[] = [];
  let startKey: Item | undefined;
  do {
    const page = await deps.db.send(
      new QueryCommand({
        TableName: deps.tableName,
        KeyConditionExpression: "#pk = :pk",
        ExpressionAttributeNames: { "#pk": PK },
        ExpressionAttributeValues: { ":pk": learnerKey(sub) },
        ConsistentRead: true,
        ExclusiveStartKey: startKey,
      }),
    );
    items.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return items;
}

async function deleteAll(deps: Deps, keys: Item[]): Promise<void> {
  for (let i = 0; i < keys.length; i += BATCH_SIZE) {
    let pending = keys.slice(i, i + BATCH_SIZE);
    // Retry whatever DynamoDB hands back unprocessed, backing off a little each round.
    for (let attempt = 0; pending.length > 0; attempt++) {
      if (attempt === 8) throw new Error("DynamoDB kept leaving items undeleted");
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
      const out = await deps.db.send(
        new BatchWriteCommand({
          RequestItems: { [deps.tableName]: pending.map((Key) => ({ DeleteRequest: { Key } })) },
        }),
      );
      pending = (out.UnprocessedItems?.[deps.tableName] ?? []).flatMap((r) =>
        r.DeleteRequest ? [r.DeleteRequest.Key as Item] : [],
      );
    }
  }
}

// DELETE /api/me: erase the Learner (GDPR). Hang up and settle any active Session first, so the GLOBAL usage
// keeps what they really used; then delete their whole partition; then their Cognito user.
export const deleteMe =
  (deps: Deps) =>
  async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyStructuredResultV2> => {
    const { sub } = callerOf(event);
    let items = await learnerItems(deps, sub);

    const active = items.filter(
      (item) => String(item[SK]).startsWith("SESSION#") && item.status === "active",
    ) as unknown as SessionItem[];
    for (const session of active) {
      if (session.callId) {
        try {
          await deps.world.openai.hangup(session.callId); // "already ended" counts as success inside hangup
        } catch (err) {
          // Nothing has been deleted yet, so the Learner can simply retry.
          console.error(`Hanging up call ${session.callId} failed`, err);
          return json(502, { error: "Couldn't end your active Session. Please try again." });
        }
      }
      await settle(deps, sub, session, "ended", 0);
    }
    // Settling can create items (Immersion time, the Streak) that the first listing didn't see.
    if (active.length > 0) items = await learnerItems(deps, sub);

    await deleteAll(
      deps,
      items.map((item) => ({ [PK]: item[PK], [SK]: item[SK] })),
    );

    try {
      await deps.world.identity.deleteUser(sub);
    } catch (err) {
      // Their data is already gone; retrying DELETE /me is safe and finishes the job.
      console.error("Deleting the Cognito user failed", err);
      return json(502, { error: "Your data was deleted but removing your sign-in failed. Please try again." });
    }
    return { statusCode: 204 };
  };
