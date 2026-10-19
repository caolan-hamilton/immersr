import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";

interface CiStackProps extends StackProps {
  githubRepo: string;
}

// GitHub OIDC → IAM role, so GitHub Actions deploys with no stored AWS keys.
// The role can only assume the CDK bootstrap roles, which do the actual deploying.
export class CiStack extends Stack {
  constructor(scope: Construct, id: string, props: CiStackProps) {
    super(scope, id, props);

    const provider = new iam.OidcProviderNative(this, "GithubOidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const role = new iam.Role(this, "DeployRole", {
      roleName: "immersr-github-deploy",
      assumedBy: new iam.WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          // A job that names a GitHub environment gets this subject instead of its branch ref. The `prod`
          // environment only allows deployments from main (docs/setup/bootstrap.md), so this still means "main only".
          "token.actions.githubusercontent.com:sub": `repo:${props.githubRepo}:environment:prod`,
        },
      }),
    });
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:AssumeRole"],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );

    new CfnOutput(this, "DeployRoleArn", { value: role.roleArn });
  }
}
