import { invokeBedrock, safeJsonParse } from './bedrock.js';

const corsOrigin = process.env.CORS_ORIGIN || '*';
const defaultModelId = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20240620-v1:0';

const SUPPORTED_MODELS = [
  { id: 'anthropic.claude-3-5-sonnet-20240620-v1:0', name: 'Claude 3.5 Sonnet' },
  { id: 'anthropic.claude-3-7-sonnet-20250219-v1:0', name: 'Claude 3.7 Sonnet' },
  { id: 'anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku' }
];

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    },
    body: JSON.stringify(payload)
  };
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

async function handleModels() {
  return jsonResponse(200, SUPPORTED_MODELS);
}

async function handleHealthcheck(event) {
  const body = parseBody(event);
  if (body === null) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const model = body.model || defaultModelId;
  const content = await invokeBedrock({
    modelId: model,
    systemPrompt: "this is a healthcheck request, respond with 'ok' if the model is supported",
    userPrompt: 'did this work?'
  });

  if (!content) {
    return jsonResponse(502, { error: 'Empty Bedrock response' });
  }

  return jsonResponse(200, { status: 'ok' });
}

async function handleChat(event) {
  const body = parseBody(event);
  if (body === null) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const model = body.model || defaultModelId;
  const systemPrompt = body.systemPrompt;
  const content = body.content;

  if (!systemPrompt || !content) {
    return jsonResponse(400, { error: 'systemPrompt and content are required' });
  }

  const rawContent = await invokeBedrock({
    modelId: model,
    systemPrompt,
    userPrompt: content
  });

  if (!rawContent) {
    return jsonResponse(502, { error: 'Empty Bedrock response' });
  }

  const parsed = safeJsonParse(rawContent);
  if (!parsed || typeof parsed !== 'object' || parsed.data === undefined) {
    return jsonResponse(502, {
      error: 'Model response did not contain valid JSON with a data field'
    });
  }

  return jsonResponse(200, { data: parsed.data });
}

export async function handler(event) {
  try {
    const method = event?.requestContext?.http?.method || event?.httpMethod;
    const path = event?.rawPath || event?.path || '/';

    if (method === 'OPTIONS') {
      return jsonResponse(200, { ok: true });
    }

    if (method === 'GET' && path.endsWith('/models')) {
      return await handleModels();
    }

    if (method === 'POST' && path.endsWith('/healthcheck')) {
      return await handleHealthcheck(event);
    }

    if (method === 'POST' && path.endsWith('/chat')) {
      return await handleChat(event);
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (error) {
    console.error('Lambda error', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
