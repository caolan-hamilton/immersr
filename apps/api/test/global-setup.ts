import { DYNAMODB_LOCAL_ENDPOINT } from "./dynamodb-local.ts";

// Fails fast with a helpful message when DynamoDB Local isn't running.
export default async function () {
  try {
    await fetch(DYNAMODB_LOCAL_ENDPOINT);
  } catch {
    throw new Error(`DynamoDB Local is not reachable at ${DYNAMODB_LOCAL_ENDPOINT}. Start it with: pnpm db:local`);
  }
}
