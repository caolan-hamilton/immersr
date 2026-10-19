import { fileURLToPath } from "node:url";
import {
  CfnDynamicReference,
  CfnDynamicReferenceService,
  CfnOutput,
  Duration,
  RemovalPolicy,
  SecretValue,
  Stack,
  Token,
  type StackProps,
} from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as ssm from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { TABLE } from "@immersr/api/table";
import type { WebConfig } from "@immersr/shared";

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

    // Sign in with Google only (ADR 0003): Google is the sole identity provider, through Cognito's managed login.
    const userPool = new cognito.UserPool(this, "Users", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });
    new cognito.CfnUserPoolGroup(this, "AdminsGroup", {
      userPoolId: userPool.userPoolId,
      groupName: "admins",
      description: "Owner: higher Daily allowance",
    });
    // The client ID and secret were stored in SSM by hand (docs/setup/google-sign-in.md). CloudFormation's
    // ssm-secure references don't work for identity providers, so the secret is a plain String resolved at deploy.
    const google = new cognito.UserPoolIdentityProviderGoogle(this, "Google", {
      userPool,
      clientId: ssm.StringParameter.valueForStringParameter(this, "/immersr/google-oauth/client-id"),
      // A {{resolve:ssm:...}} dynamic reference, so the value never appears in the template or stack parameters.
      clientSecretValue: SecretValue.unsafePlainText(
        Token.asString(new CfnDynamicReference(CfnDynamicReferenceService.SSM, "/immersr/google-oauth/client-secret")),
      ),
      scopes: ["openid", "email", "profile"],
      attributeMapping: { email: cognito.ProviderAttribute.GOOGLE_EMAIL },
    });
    // The prefix is registered in Google as a redirect URI, so it must match exactly: immersr-prod, immersr-dev-<user>.
    const userPoolDomain = userPool.addDomain("Domain", { cognitoDomain: { domainPrefix: `immersr-${props.stage}` } });
    const siteUrl = `https://${distribution.distributionDomainName}`;
    const userPoolClient = userPool.addClient("WebClient", {
      generateSecret: false,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [siteUrl, "http://localhost:5173"],
        logoutUrls: [siteUrl, "http://localhost:5173"],
      },
      refreshTokenValidity: Duration.days(30),
    });
    userPoolClient.node.addDependency(google);

    const authorizer = new HttpJwtAuthorizer("Jwt", userPool.userPoolProviderUrl, {
      jwtAudience: [userPoolClient.userPoolClientId],
    });
    api.addRoutes({
      path: "/api/me",
      methods: [apigw.HttpMethod.GET],
      integration: new HttpLambdaIntegration("MeIntegration", meFn),
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
