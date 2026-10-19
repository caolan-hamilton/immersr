// Stacks:
//   Immersr-prod         deployed by GitHub Actions on push to main
//   Immersr-dev-<user>   personal stage, deployed from a laptop (pnpm deploy:dev)
//   Immersr-ci           GitHub OIDC deploy role, deployed once by the owner (docs/setup/bootstrap.md)
import { App } from "aws-cdk-lib";
import { AppStack } from "../lib/app-stack.ts";
import { CiStack } from "../lib/ci-stack.ts";

const app = new App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" };

new AppStack(app, "Immersr-prod", { env, stage: "prod" });

// Only the current user's dev stack is defined, so `pnpm deploy:dev` can select it with the pattern "Immersr-dev-*".
const user = (process.env.USER ?? "local").toLowerCase().replace(/[^a-z0-9]/g, "");
new AppStack(app, `Immersr-dev-${user}`, { env, stage: `dev-${user}` });

new CiStack(app, "Immersr-ci", { env, githubOidcSubjectPrefix: app.node.getContext("githubOidcSubjectPrefix") });
