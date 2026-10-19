// Where the tests find DynamoDB Local (`pnpm db:local` locally, a service container in CI).
export const DYNAMODB_LOCAL_ENDPOINT = process.env.DYNAMODB_ENDPOINT ?? "http://localhost:8000";
