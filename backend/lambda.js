import {
  invokeBedrockWithModelFallback,
  listAvailableTextModels,
  safeJsonParse
} from './bedrock.js';

const corsOrigin = process.env.CORS_ORIGIN || '*';
const defaultModelId = process.env.BEDROCK_MODEL_ID || 'auto';
const AUTO_MODEL_ID = 'auto';

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
  let discoveredModels = [];
  try {
    discoveredModels = await listAvailableTextModels();
  } catch (error) {
    console.warn('Unable to list Bedrock models; returning auto option only', error);
  }
  const models = [
    {
      id: AUTO_MODEL_ID,
      name: 'Auto (latest high-capability model)'
    },
    ...discoveredModels.map((model) => ({
      id: model.id,
      name: `${model.name} (${model.provider})`
    }))
  ];
  return jsonResponse(200, models);
}

async function handleHealthcheck(event) {
  const body = parseBody(event);
  if (body === null) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const selectedModel = body.model || defaultModelId;
  const { content, modelId } = await invokeBedrockWithModelFallback({
    requestedModelId: selectedModel,
    defaultModelId,
    systemPrompt: "this is a healthcheck request, respond with 'ok' if the model is supported",
    userPrompt: 'did this work?'
  });

  if (!content) {
    return jsonResponse(502, { error: 'Empty Bedrock response' });
  }

  return jsonResponse(200, { status: 'ok', model: modelId });
}

async function handleChat(event) {
  const body = parseBody(event);
  if (body === null) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const selectedModel = body.model || defaultModelId;
  const systemPrompt = body.systemPrompt;
  const content = body.content;

  if (!systemPrompt || !content) {
    return jsonResponse(400, { error: 'systemPrompt and content are required' });
  }

  const { content: rawContent, modelId } = await invokeBedrockWithModelFallback({
    requestedModelId: selectedModel,
    defaultModelId,
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

  return jsonResponse(200, { data: parsed.data, model: modelId });
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
