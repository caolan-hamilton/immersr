// Fails fast with a helpful message when DynamoDB Local isn't running.
export default async function () {
  const endpoint = process.env.DYNAMODB_ENDPOINT ?? "http://localhost:8000";
  try {
    await fetch(endpoint);
  } catch {
    throw new Error(`DynamoDB Local is not reachable at ${endpoint}. Start it with: pnpm db:local`);
  }
}
