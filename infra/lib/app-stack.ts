import { fileURLToPath } from "node:url";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import { OPENAI_API_KEY_PARAMETER } from "@immersr/api/openai-key";
import { TABLE } from "@immersr/api/table";
import type { WebConfig } from "@immersr/shared";
import { Auth } from "./auth.ts";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

interface AppStackProps extends StackProps {
  stage: string;
}

// Everything is pay-per-use: no fixed monthly cost.
export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);
    const isProd = props.stage === "prod";

    // Single table, keyed by Learner (ADR 0002, ADR 0006).
    const table = new dynamodb.TableV2(this, "Table", {
      partitionKey: { name: TABLE.partitionKey, type: dynamodb.AttributeType.STRING },
      sortKey: { name: TABLE.sortKey, type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      timeToLiveAttribute: TABLE.ttlAttribute,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      deletionProtection: isProd,
    });

    const fn = (name: string, entry: string) =>
      new NodejsFunction(this, name, {
        entry: path(`../../apps/api/src/handlers/${entry}`),
        runtime: Runtime.NODEJS_22_X,
        memorySize: 256,
        timeout: Duration.seconds(10),
        logGroup: new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.ONE_MONTH,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        environment: { TABLE_NAME: table.tableName, STAGE: props.stage },
        bundling: { format: OutputFormat.ESM, target: "node22", sourceMap: true, minify: true },
      });

    const healthFn = fn("HealthFn", "health.ts");
    table.grantReadData(healthFn);

    const meFn = fn("MeFn", "me.ts");
    table.grantReadData(meFn);

    // The OpenAI key is a SecureString the owner creates by hand; the Lambda reads it at runtime only.
    const sessionsFn = fn("SessionsFn", "sessions.ts");
    const endSessionFn = fn("EndSessionFn", "end-session.ts");
    const deleteMeFn = fn("DeleteMeFn", "delete-me.ts"); // hangs up an active Session, so it needs the key too
    for (const f of [sessionsFn, endSessionFn, deleteMeFn]) {
      table.grantReadWriteData(f);
      f.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["ssm:GetParameter"],
          resources: [`arn:${this.partition}:ssm:${this.region}:${this.account}:parameter${OPENAI_API_KEY_PARAMETER}`],
        }),
      );
    }

    const api = new apigw.HttpApi(this, "Api", { createDefaultStage: true });
    api.addRoutes({
      path: "/api/health",
      methods: [apigw.HttpMethod.GET],
      integration: new HttpLambdaIntegration("HealthIntegration", healthFn),
    });

    // Private bucket served through CloudFront (Origin Access Control); /api/* goes to the HTTP API,
    // so the browser only ever talks to one origin.
    const site = new s3.Bucket(this, "Site", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const apiDomain = `${api.apiId}.execute-api.${this.region}.amazonaws.com`;

    // Single-page app routing: paths without a file extension get index.html. This is scoped to the
    // site behaviour so the API's own 403/404 responses pass through untouched.
    const spaFallback = new cloudfront.Function(this, "SpaFallback", {
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(
        `function handler(event) {
          var request = event.request;
          if (!request.uri.includes(".")) request.uri = "/index.html";
          return request;
        }`,
      ),
    });
    const distribution = new cloudfront.Distribution(this, "Cdn", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        functionAssociations: [{ function: spaFallback, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }],
      },
      additionalBehaviors: {
        "/api/*": {
          origin: new origins.HttpOrigin(apiDomain),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    const { userPool, userPoolClient, userPoolDomain } = new Auth(this, "Auth", {
      stage: props.stage,
      isProd,
      siteUrl: `https://${distribution.distributionDomainName}`,
    });

    const authorizer = new HttpJwtAuthorizer("Jwt", userPool.userPoolProviderUrl, {
      jwtAudience: [userPoolClient.userPoolClientId],
    });
    api.addRoutes({
      path: "/api/me",
      methods: [apigw.HttpMethod.GET],
      integration: new HttpLambdaIntegration("MeIntegration", meFn),
      authorizer,
    });

    deleteMeFn.addEnvironment("USER_POOL_ID", userPool.userPoolId);
    deleteMeFn.addToRolePolicy(
      new iam.PolicyStatement({ actions: ["cognito-idp:AdminDeleteUser"], resources: [userPool.userPoolArn] }),
    );
    api.addRoutes({
      path: "/api/me",
      methods: [apigw.HttpMethod.DELETE],
      integration: new HttpLambdaIntegration("DeleteMeIntegration", deleteMeFn),
      authorizer,
    });

    api.addRoutes({
      path: "/api/sessions",
      methods: [apigw.HttpMethod.POST],
      integration: new HttpLambdaIntegration("SessionsIntegration", sessionsFn),
      authorizer,
    });

    api.addRoutes({
      path: "/api/sessions/{id}/end",
      methods: [apigw.HttpMethod.POST],
      integration: new HttpLambdaIntegration("EndSessionIntegration", endSessionFn),
      authorizer,
    });

    const webConfig: WebConfig = {
      cognitoDomain: userPoolDomain.baseUrl(),
      clientId: userPoolClient.userPoolClientId,
    };

    new s3deploy.BucketDeployment(this, "DeploySite", {
      sources: [
        s3deploy.Source.asset(path("../../apps/web/dist")),
        s3deploy.Source.jsonData("config.json", webConfig),
      ],
      destinationBucket: site,
      distribution,
      distributionPaths: ["/*"],
    });

    new CfnOutput(this, "Url", { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, "ApiUrl", { value: api.apiEndpoint });
  }
}
