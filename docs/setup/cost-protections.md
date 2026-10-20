# Cost protections (owner)

Sessions are open to every signed-in Learner (#12), and every Session spends real money on OpenAI. Spend is bounded in layers, from the code outward:

1. **Daily allowance:** 15 minutes per Learner per day (90 for `admins`), reserved before a Session starts (ADR 0004).
2. **Global daily cap:** 45 minutes a day across all non-admin Learners. One conditional DynamoDB update reserves against both (ADR 0004). The values are in `apps/api/src/lib/limits.ts`.
3. **Scheduled hang-up:** every Session is cut off at its maximum length, even if the tab is abandoned.
4. **The OpenAI account itself**, below: this is the final ceiling.
5. **An AWS Budget alert** for everything that runs on AWS.

## OpenAI account

Set up once in the OpenAI dashboard:

- [ ] A dedicated **Immersr** project, whose API key is the one stored in SSM Parameter Store as `/immersr/openai/api-key`.
- [ ] Billing on **prepaid credits with auto-recharge off**, so spend can never exceed what's loaded (ADR 0004).
- [ ] A **budget alert at $10** on the project.
- [ ] The project restricted to the models Immersr uses: `gpt-realtime-2.1-mini` (the Partner), `gpt-4o-mini-transcribe` (the Learner's speech) and `omni-moderation-latest` (Topic checks).

## AWS Budget

An email alert when monthly AWS spend passes **$5**. It covers **AWS only**: OpenAI is billed separately, and is covered by the prepaid credits above.

```sh
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
aws budgets create-budget --account-id "$ACCOUNT" \
  --budget '{"BudgetName":"immersr-monthly","BudgetLimit":{"Amount":"5","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' \
  --notifications-with-subscribers '[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":100,"ThresholdType":"PERCENTAGE"},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"<your email>"}]}]'
```

It isn't part of the CDK app, because it applies to the whole AWS account, and the alert address shouldn't live in a public repo.
