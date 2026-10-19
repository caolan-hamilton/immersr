# Immersr

A language-immersion web app. A live AI voice Partner speaks only the Target language, and the Learner replies in English. Read [GLOSSARY.md](GLOSSARY.md) for the vocabulary and [docs/adr/](docs/adr/) for the decisions behind the design. The MVP spec is issue #1.

## Layout

| Path | What |
|---|---|
| `apps/web` | React + Vite single-page app |
| `apps/api` | Lambda handlers (Node/TypeScript), test harness |
| `packages/shared` | zod request/response schemas used by web and api |
| `infra` | AWS CDK app: `Immersr-prod`, `Immersr-dev-<you>`, `Immersr-ci` |
| `spikes/` | throwaway experiments (voice accent/drift test) |

## Develop

Requirements: Node 22 (`nvm use`), pnpm (`corepack enable pnpm`), and Docker for DynamoDB Local.

```sh
pnpm install
pnpm db:local        # start DynamoDB Local on :8000 (Docker)
pnpm test            # API tests through the API seam
pnpm typecheck
```

### Personal dev stack

Your own stage, deployed from your laptop (needs AWS credentials and the one-off bootstrap in [docs/setup/bootstrap.md](docs/setup/bootstrap.md)):

```sh
pnpm deploy:dev      # deploys your Immersr-dev-<you> stack and prints its Url
API_PROXY=<that Url> pnpm dev:web   # local Vite app talking to your dev API
```

## Deploy

`prod` deploys from GitHub Actions on every push to `main`: typecheck → tests (with DynamoDB Local) → `cdk synth` → `cdk diff` → deploy. It uses GitHub OIDC, so no AWS keys are stored. The one-off setup is in [docs/setup/bootstrap.md](docs/setup/bootstrap.md).
