# Single DynamoDB table, keyed by Learner

All app data lives in one table. Every Learner-owned item (Sessions, daily usage, Immersion totals) shares the partition key `LEARNER#{sub}`. The global daily counter lives under `GLOBAL`.

We chose this layout for three reasons:

1. **Ownership checks come free.** The Learner's ID from their sign-in token is part of every key, so a Learner can only ever reach their own items.
2. **Erasure is one query.** Deleting an account (GDPR) is a single query on `LEARNER#{sub}` followed by a batch delete.
3. **Settlement is safe.** Reserving minutes and settling a Session are each one transaction against items whose keys we already know.

Settlement is conditional on the Session's `status = active`, so a Session's refund happens exactly once even if the End call and the scheduled hang-up race. The refund goes back to the Session's stored `usageDay`, not the current day, so a Session that crosses midnight UTC refunds the day it was reserved against.

## Considered Options

- **One table per entity**: easier to picture, but erasure touches several tables and ownership has to be checked separately.

## Consequences

- The `GLOBAL` item is a hot key, since every Session writes to it. This is fine below about 1,000 writes per second. If it ever matters, shard the counter.
- Usage items carry a TTL, so old days delete themselves.
