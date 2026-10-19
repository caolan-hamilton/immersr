// Stacks:
//   Crosstalki-prod         deployed by GitHub Actions on push to main
//   Crosstalki-dev-<user>   personal stage, deployed from a laptop (pnpm deploy:dev)
//   Crosstalki-ci           GitHub OIDC deploy role, deployed once by the owner (docs/setup/bootstrap.md)
import { App } from "aws-cdk-lib";
import { AppStack } from "../lib/app-stack.ts";
import { CiStack } from "../lib/ci-stack.ts";

const app = new App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: "eu-west-1" };

new AppStack(app, "Crosstalki-prod", { env, stage: "prod" });

const user = (process.env.USER ?? "local").toLowerCase().replace(/[^a-z0-9]/g, "");
new AppStack(app, `Crosstalki-dev-${user}`, { env, stage: `dev-${user}` });

new CiStack(app, "Crosstalki-ci", { env, githubRepo: app.node.getContext("githubRepo") });
