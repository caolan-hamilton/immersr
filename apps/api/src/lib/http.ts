import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export const json = (statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
