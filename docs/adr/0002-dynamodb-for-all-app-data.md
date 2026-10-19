# DynamoDB for all app data

All app data lives in a single DynamoDB on-demand table: Session records, the per-Learner daily usage counters, the global daily counter and the Immersion time totals. Every access pattern is known and key-based. The hard requirement is an atomic "increment only if under the cap" before each Session starts, which a conditional `ADD` update does in one call. DynamoDB also costs about $0 at idle and needs no VPC.

## Considered Options

- **Aurora Serverless v2 (minimum 0 ACU)**: compute costs nothing while paused, but it takes 15–30+ seconds to resume, and it needs a VPC. A VPC Lambda that also calls OpenAI needs a NAT gateway (~$32/month fixed) unless it uses the RDS Data API.
- **RDS Postgres (t4g.micro)**: ~$12–15/month fixed after the free tier, with the same VPC/NAT issue.

## Consequences

- No ad-hoc relational queries. If analytics are needed later, export to S3 and query with Athena rather than moving the operational store.
