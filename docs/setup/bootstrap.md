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
npx cdk deploy Immersr-ci
```

Note the `DeployRoleArn` output. The role trusts only jobs on this repo that run in the GitHub `prod` environment, and it can only assume the CDK bootstrap roles.

The trust is keyed on the OIDC `sub` claim. This repo uses GitHub's **immutable subject** format (`repo:<owner>@<owner id>/<repo>@<repo id>:environment:prod`), so `infra/cdk.json` stores the prefix as `githubOidcSubjectPrefix`. If you recreate the repo or move it, read the new prefix and update that value before deploying:

```sh
gh api repos/<owner>/<repo>/actions/oidc/customization/sub -q .sub_claim_prefix
```

> If your account already has a GitHub OIDC provider (`token.actions.githubusercontent.com`), this deploy fails with "already exists". In that case, delete the old provider, or ask for `CiStack` to import the existing one.

## 4. Tell GitHub about the role

```sh
gh variable set AWS_DEPLOY_ROLE_ARN --body "<DeployRoleArn from step 3>"
```

The workflow's deploy job is skipped until this variable exists.

## 5. Restrict the `prod` environment to `main`

The deploy role trusts the `prod` environment, so the environment itself must only accept deployments from `main`. Otherwise a workflow on any branch could name `prod` and deploy.

```sh
gh api -X PUT repos/caolan-hamilton/immersr/environments/prod \
  -F "deployment_branch_policy[protected_branches]=false" \
  -F "deployment_branch_policy[custom_branch_policies]=true"
gh api -X POST repos/caolan-hamilton/immersr/environments/prod/deployment-branch-policies -f name=main -f type=branch
```

You can also add required reviewers to `prod` later if you want a manual approval gate before each deploy.

## 6. Check it

Push to `main`. Then open the `Url` output of `Immersr-prod` (shown in the workflow log, or by running `aws cloudformation describe-stacks --stack-name Immersr-prod --region eu-west-1`). The page should show "API healthy on **prod**".
