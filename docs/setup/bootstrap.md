# One-off AWS setup (owner)

Do this once, with your own AWS credentials (an admin user or SSO profile). After it's done, every push to `main` deploys `prod` through GitHub Actions without any stored AWS keys.

## 1. Sign in to AWS

```sh
aws configure sso        # or: aws configure, with an admin access key
aws sts get-caller-identity
```

## 2. Bootstrap CDK in eu-west-1

```sh
cd infra
npx cdk bootstrap aws://<ACCOUNT_ID>/eu-west-1
```

This creates the `cdk-*` roles and asset bucket that every deploy uses.

## 3. Deploy the GitHub OIDC deploy role

```sh
npx cdk deploy Crosstalki-ci
```

Note the `DeployRoleArn` output. The role trusts only pushes to `main` on `caolan-hamilton/crosstalki`, and it can only assume the CDK bootstrap roles.

> If your account already has a GitHub OIDC provider (`token.actions.githubusercontent.com`), this deploy fails with "already exists". In that case, delete the old provider, or ask for `CiStack` to import the existing one.

## 4. Tell GitHub about the role

```sh
gh variable set AWS_DEPLOY_ROLE_ARN --body "<DeployRoleArn from step 3>"
```

The workflow's deploy job is skipped until this variable exists. The workflow also uses a GitHub environment named `prod`, which is created automatically on the first deploy. You can add required reviewers to it later if you want a manual approval gate.

## 5. Check it

Push to `main`. Then open the `Url` output of `Crosstalki-prod` (shown in the workflow log, or by running `aws cloudformation describe-stacks --stack-name Crosstalki-prod --region eu-west-1`). The page should show "API healthy on **prod**".
