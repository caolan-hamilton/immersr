import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { Auth } from "../lib/auth.ts";

// ADR 0003: Google is the only way to get a token. These fail if native sign-up or password flows come back.
describe("Auth (Google only)", () => {
  const stack = new Stack(new App(), "Test");
  new Auth(stack, "Auth", { stage: "test", isProd: false, siteUrl: "https://example.test" });
  const template = Template.fromStack(stack);

  it("does not let anyone sign up natively", () => {
    template.hasResourceProperties("AWS::Cognito::UserPool", {
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: true },
    });
  });

  it("allows no password or SRP auth flows on the app client", () => {
    const clients = Object.values(template.findResources("AWS::Cognito::UserPoolClient"));
    expect(clients).toHaveLength(1);
    const flows: string[] = clients[0]?.Properties.ExplicitAuthFlows ?? [];
    expect(flows.filter((f) => f !== "ALLOW_REFRESH_TOKEN_AUTH")).toEqual([]);
  });

  // ADR 0007: erasing a Learner can't revoke their tokens, so they must expire fast.
  it("keeps access and ID tokens to 15 minutes and refresh tokens to 30 days", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      AccessTokenValidity: 15,
      IdTokenValidity: 15,
      RefreshTokenValidity: 43200,
      TokenValidityUnits: { AccessToken: "minutes", IdToken: "minutes", RefreshToken: "minutes" },
    });
  });

  it("offers Google as the only identity provider", () => {
    template.hasResourceProperties("AWS::Cognito::UserPoolClient", {
      SupportedIdentityProviders: ["Google"],
      AllowedOAuthFlows: ["code"],
    });
    template.resourceCountIs("AWS::Cognito::UserPoolIdentityProvider", 1);
  });
});
