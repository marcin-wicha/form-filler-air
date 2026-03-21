# Bedrock Lambda Backend

This folder contains an AWS Lambda handler that replaces direct GitHub Models calls from the browser extension.

## Endpoints

- `GET /models` - Returns available model options for the popup selector.
- `POST /healthcheck` - Validates Bedrock connectivity for a selected model.
- `POST /chat` - Sends `systemPrompt` and `content` to Bedrock and returns parsed `{ data: ... }`.

## Environment variables

- `AWS_REGION` (required) - AWS region where Bedrock is enabled (e.g. `us-east-1`).
- `BEDROCK_MODEL_ID` (optional) - Default model to use when request does not provide one.
  - Default: `anthropic.claude-3-5-sonnet-20240620-v1:0`
- `CORS_ORIGIN` (optional) - CORS origin. Default `*`.

## Deploy

1. Zip files in this directory (`lambda.js`, `bedrock.js`, `package.json`).
2. Create/update Lambda with Node.js 20 runtime.
3. Configure Lambda environment variables.
4. Attach IAM permissions to invoke Bedrock model(s), for example:
   - `bedrock:InvokeModel`
   - `bedrock:InvokeModelWithResponseStream` (optional)
5. Put API Gateway in front of Lambda with routes:
   - `GET /models`
   - `POST /healthcheck`
   - `POST /chat`
6. Replace `FORM_FILLER_BACKEND_BASE_URL` in `dist/extension/llm/system.js` with your API Gateway URL.

