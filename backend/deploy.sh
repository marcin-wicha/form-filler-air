#!/usr/bin/env bash

set -euo pipefail

if ! command -v sam >/dev/null 2>&1; then
  echo "Error: AWS SAM CLI is not installed. Install it from https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "Error: AWS CLI is not installed."
  exit 1
fi

if ! aws sts get-caller-identity >/dev/null 2>&1; then
  echo "Error: AWS CLI is not authenticated/configured. Run: aws configure"
  exit 1
fi

STACK_NAME="${STACK_NAME:-form-filler-bedrock-backend}"
AWS_REGION="${AWS_REGION:-us-east-1}"
BEDROCK_MODEL_ID="${BEDROCK_MODEL_ID:-auto}"
CORS_ORIGIN="${CORS_ORIGIN:-*}"
STAGE_NAME="${STAGE_NAME:-prod}"

echo "Deploying stack: ${STACK_NAME}"
echo "Region: ${AWS_REGION}"
echo "Stage: ${STAGE_NAME}"
echo "Model: ${BEDROCK_MODEL_ID}"
echo "CORS origin: ${CORS_ORIGIN}"

cd "$(dirname "$0")"

sam build

sam deploy \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    StageName="${STAGE_NAME}" \
    BedrockModelId="${BEDROCK_MODEL_ID}" \
    CorsOrigin="${CORS_ORIGIN}"

API_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --region "${AWS_REGION}" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" \
  --output text)

echo ""
echo "Deployment complete."
echo "API base URL: ${API_URL}"
echo "Set this in dist/extension/llm/system.js as FORM_FILLER_BACKEND_BASE_URL."
