# Google sign-in and the `admins` group (owner)

Learners sign in with Google only (ADR 0003), through Cognito's managed login page.

## 1. Google OAuth client (once, already done)

A Web OAuth client in the Google Cloud project `Immersr` covers both stages. Its credentials are stored in SSM Parameter Store in eu-west-1 as plain `String` parameters (CloudFormation's `ssm-secure` references don't work for Cognito identity providers):

- `/immersr/google-oauth/client-id`
- `/immersr/google-oauth/client-secret`

The CDK app reads the secret through a `{{resolve:ssm:...}}` dynamic reference at deploy time, so the value never appears in the template.

Each stage's Cognito domain prefix is `immersr-<stage>`, and its redirect URI must be registered in Google as `https://<prefix>.auth.eu-west-1.amazoncognito.com/oauth2/idpresponse`:

| Stage | Prefix |
| --- | --- |
| prod | `immersr-prod` |
| dev | `immersr-dev-<user>` (for example `immersr-dev-caolanhamilton`) |

Until the app is published (#12), the OAuth consent screen is in Testing status, so only listed test users can sign in. Add anyone else under **Google Auth Platform → Audience → Test users**.

## 2. Add yourself to `admins`

The stack creates the `admins` group (90 minute Daily allowance instead of 15). Membership is manual. Sign in once first so your Cognito user exists, then:

```sh
POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --region eu-west-1 \
  --query "UserPools[?Name=='<user pool name from the console>'].Id" --output text)
aws cognito-idp list-users --user-pool-id "$POOL_ID" --region eu-west-1 --query "Users[].Username"
aws cognito-idp admin-add-user-to-group --user-pool-id "$POOL_ID" --region eu-west-1 \
  --username "<username, like Google_1234567890>" --group-name admins
```

(Or use the console: Cognito → User pools → your pool → Groups → `admins` → Add user to group.)

Sign out and back in: the group is carried in the ID token's `cognito:groups` claim, so it only takes effect on a fresh token.

## 3. Local development

Run `pnpm dev:web` and set `API_PROXY` to your dev stack's CloudFront URL. `http://localhost:5173` is a registered callback and sign-out URL. Note that `/config.json` is served by the deployed stack, so for local development copy the dev stack's `https://<cloudfront>/config.json` to `apps/web/public/config.json` (don't commit it).
