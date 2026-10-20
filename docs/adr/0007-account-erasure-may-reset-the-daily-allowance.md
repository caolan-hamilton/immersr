# Account erasure may reset the Daily allowance

Deleting an account removes everything under `LEARNER#{sub}`, including today's usage item. So a deleted Learner can get a Daily allowance back in two ways: with a token that is still valid (access and ID tokens now last at most 15 minutes, since Cognito can't revoke them on `AdminDeleteUser`), or by signing in with Google again, which creates a new `sub` with no usage.

We accept this. Spend stays bounded by the global daily cap and the prepaid OpenAI credits. Making extra Google accounts is a bigger version of the same gap and we already accept it (ADR 0003). GDPR data minimisation also favours keeping nothing about an erased Learner.

To shrink the stale-token window, the Cognito app client sets access and ID token validity to 15 minutes. The refresh token stays at 30 days. The web app renews the ID token with the refresh token a minute before it expires, so Learners notice nothing.

## Considered Options

- **Reject requests whose Cognito user no longer exists**: closes the stale-token path only, and adds a Cognito call to every request.
- **A hashed "erased" marker, kept for 48 hours at most, keyed on the stable Cognito username (`Google_<id>`), that carries today's usage over**: closes both paths, but keeps data about an erased Learner. Rejected for now. Revisit it if abuse appears after #12 opens the app.
- **Accept the gap and shorten token lifetimes** (chosen).

## Consequences

- A deleted Learner can spend at most one more Daily allowance per delete-and-return cycle, within the global cap.
- A Session started with a stale token recreates a `LEARNER#{sub}` partition. Its scheduled hang-up settles it, but the partition stays.
