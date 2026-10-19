// The single-table key design (ADR 0006). Shared by the CDK stack and the test harness
// so tests always run against the same table shape as production.
export const TABLE = {
  partitionKey: "PK",
  sortKey: "SK",
  ttlAttribute: "ttl",
} as const;
