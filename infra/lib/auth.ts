import { CfnDynamicReference, CfnDynamicReferenceService, Duration, RemovalPolicy, SecretValue, Token } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface AuthProps {
  stage: string;
  isProd: boolean;
  siteUrl: string;
}

// Sign in with Google only (ADR 0003): Google is the sole identity provider, through Cognito's managed login.
export class Auth extends Construct {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AuthProps) {
    super(scope, id);

    // Native sign-up stays closed: the client ID is public (/config.json), so an open SignUp API would let a
    // script mint Cognito users and tokens without Google. Google users are still created on first federated login.
    this.userPool = new cognito.UserPool(this, "Users", {
      selfSignUpEnabled: false,
      removalPolicy: props.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });
    new cognito.CfnUserPoolGroup(this, "AdminsGroup", {
      userPoolId: this.userPool.userPoolId,
      groupName: "admins",
      description: "Owner: higher Daily allowance",
    });
    // The client ID and secret were stored in SSM by hand (docs/setup/google-sign-in.md). CloudFormation's
    // ssm-secure references don't work for identity providers, so the secret is a plain String resolved at deploy.
    const google = new cognito.UserPoolIdentityProviderGoogle(this, "Google", {
      userPool: this.userPool,
      clientId: ssm.StringParameter.valueForStringParameter(this, "/immersr/google-oauth/client-id"),
      // A {{resolve:ssm:...}} dynamic reference, so the value never appears in the template or stack parameters.
      clientSecretValue: SecretValue.unsafePlainText(
        Token.asString(new CfnDynamicReference(CfnDynamicReferenceService.SSM, "/immersr/google-oauth/client-secret")),
      ),
      scopes: ["openid", "email", "profile"],
      attributeMapping: { email: cognito.ProviderAttribute.GOOGLE_EMAIL },
    });
    // The prefix is registered in Google as a redirect URI, so it must match exactly: immersr-prod, immersr-dev-<user>.
    this.userPoolDomain = this.userPool.addDomain("Domain", {
      cognitoDomain: { domainPrefix: `immersr-${props.stage}` },
    });
    this.userPoolClient = this.userPool.addClient("WebClient", {
      generateSecret: false,
      supportedIdentityProviders: [cognito.UserPoolClientIdentityProvider.GOOGLE],
      // No password or SRP flows: only the authorization-code flow (via Google) and refresh tokens can produce tokens.
      authFlows: { userSrp: false, userPassword: false, adminUserPassword: false, custom: false },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: [props.siteUrl, "http://localhost:5173"],
        logoutUrls: [props.siteUrl, "http://localhost:5173"],
      },
      refreshTokenValidity: Duration.days(30),
    });
    this.userPoolClient.node.addDependency(google);
  }
}
