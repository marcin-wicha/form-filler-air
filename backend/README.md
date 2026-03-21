# Bedrock Lambda Backend

This folder contains an AWS Lambda handler that replaces direct GitHub Models calls from the browser extension.

## Endpoints

- `GET /models` - Returns available model options for the popup selector.
- `POST /healthcheck` - Validates Bedrock connectivity for a selected model.
- `POST /chat` - Sends `systemPrompt` and `content` to Bedrock and returns parsed `{ data: ... }`.

## Environment variables

- `AWS_REGION` (required) - AWS region where Bedrock is enabled (e.g. `us-east-1`).
- `BEDROCK_MODEL_ID` (optional) - Default model to use when request does not provide one.
  - Default: `auto` (automatically picks latest high-capability available text model)
- `CORS_ORIGIN` (optional) - CORS origin. Default `*`.

## Deploy with AWS SAM (recommended)

### Prerequisites

- AWS CLI configured (`aws configure`)
- AWS SAM CLI installed
- Docker running (required by `sam build --use-container`)
- Bedrock model access enabled in your AWS account/region

### One-time guided setup

From this directory:

```bash
sam deploy --guided
```

Use these values when prompted:

- Stack Name: `form-filler-bedrock-backend`
- AWS Region: `us-east-1` (or your Bedrock-enabled region)
- Confirm changes before deploy: `N`
- Allow SAM CLI IAM role creation: `Y`
- Save arguments to configuration file: `Y`

This writes deploy defaults into `samconfig.toml`.

### Fast deploy (after guided setup)

```bash
./deploy.sh
```

Or manually:

```bash
sam build --use-container
sam deploy
```

### Deploy with custom values

You can override defaults:

```bash
sam deploy \
  --parameter-overrides \
  BedrockModelId=auto \
  CorsOrigin=* \
  StageName=prod
```

### Get the API URL

```bash
aws cloudformation describe-stacks \
  --stack-name form-filler-bedrock-backend \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" \
  --output text
```

Set that URL in:

- `dist/extension/llm/system.js`
  - `FORM_FILLER_BACKEND_BASE_URL = "https://.../prod"`

### Notes

- `template.yaml` provisions:
  - Lambda (Node.js 20)
  - HTTP API with routes: `/models`, `/healthcheck`, `/chat`
  - IAM policy for Bedrock model invocation and model discovery
- If you use a specific model policy scope later, narrow the IAM resource from `*` to model ARNs.

