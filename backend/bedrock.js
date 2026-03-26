import { BedrockClient, ListFoundationModelsCommand } from '@aws-sdk/client-bedrock';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1'
});
const bedrockControlClient = new BedrockClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const AUTO_MODEL_ID = 'auto';
let cachedModels = {
  expiresAt: 0,
  models: []
};

function normalizeTextFromConverseOutput(output) {
  const parts = output?.message?.content;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => part?.text || '')
    .join('')
    .trim();
}

export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function scoreModelPriority(model) {
  const haystack = `${model.id} ${model.name}`.toLowerCase();
  let score = 0;

  // Prefer highest-capability families first.
  if (haystack.includes('opus')) score += 140;
  if (haystack.includes('sonnet')) score += 130;
  if (haystack.includes('premier')) score += 120;
  if (haystack.includes('ultra')) score += 110;
  if (haystack.includes('pro')) score += 95;
  if (haystack.includes('large')) score += 90;
  if (haystack.includes('70b') || haystack.includes('90b') || haystack.includes('405b')) score += 85;

  // De-prioritize lighter/cheaper variants.
  if (haystack.includes('haiku')) score -= 80;
  if (haystack.includes('mini') || haystack.includes('small')) score -= 90;
  if (haystack.includes('nano') || haystack.includes('micro')) score -= 100;
  if (haystack.includes('lite') || haystack.includes('instant')) score -= 60;

  const dateMatches = model.id.match(/20\d{6}/g);
  if (dateMatches?.length) {
    const latestDateStamp = Math.max(...dateMatches.map((value) => Number.parseInt(value, 10)));
    // Light bonus for recency while keeping capability weighting dominant.
    score += Math.floor(latestDateStamp / 10000);
  }

  return score;
}

function dedupeById(models) {
  const seen = new Set();
  return models.filter((model) => {
    if (!model?.id || seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
}

function normalizeModelSummary(summary) {
  const id = summary?.modelId;
  if (!id) return null;
  return {
    id,
    name: summary?.modelName || id,
    provider: summary?.providerName || 'Unknown',
    lifecycleStatus: summary?.modelLifecycle?.status || 'UNKNOWN',
    inputModalities: summary?.inputModalities || [],
    outputModalities: summary?.outputModalities || [],
    inferenceTypesSupported: summary?.inferenceTypesSupported || []
  };
}

function modelSupportsText(model) {
  const input = model.inputModalities.map((value) => value.toUpperCase());
  const output = model.outputModalities.map((value) => value.toUpperCase());
  return input.includes('TEXT') && output.includes('TEXT');
}

function modelSupportsOnDemand(model) {
  const supported = model?.inferenceTypesSupported;
  if (!Array.isArray(supported) || supported.length === 0) {
    // Older/partial SDK responses may omit this field; assume on-demand to avoid hiding models.
    return true;
  }
  return supported.map((value) => `${value}`.toUpperCase()).includes('ON_DEMAND');
}

function isDeprecatedLifecycle(model) {
  const lifecycle = model.lifecycleStatus.toUpperCase();
  return lifecycle === 'LEGACY' || lifecycle === 'DEPRECATED';
}

async function fetchModelCatalog() {
  const response = await bedrockControlClient.send(
    new ListFoundationModelsCommand({ byOutputModality: 'TEXT' })
  );
  const normalized = (response?.modelSummaries || []).map(normalizeModelSummary).filter(Boolean);

  const preferred = normalized
    .filter(
      (model) =>
        modelSupportsText(model) && modelSupportsOnDemand(model) && !isDeprecatedLifecycle(model)
    )
    .sort((a, b) => scoreModelPriority(b) - scoreModelPriority(a));

  const fallback = normalized
    .filter((model) => modelSupportsText(model) && modelSupportsOnDemand(model) && isDeprecatedLifecycle(model))
    .sort((a, b) => scoreModelPriority(b) - scoreModelPriority(a));

  return dedupeById([...preferred, ...fallback]);
}

export async function listAvailableTextModels({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && cachedModels.expiresAt > now && cachedModels.models.length > 0) {
    return cachedModels.models;
  }

  const models = await fetchModelCatalog();
  cachedModels = {
    expiresAt: now + MODEL_CACHE_TTL_MS,
    models
  };
  return models;
}

function toUniqueCandidateIds(candidateIds) {
  const unique = [];
  const seen = new Set();
  for (const value of candidateIds) {
    const modelId = typeof value === 'string' ? value.trim() : '';
    if (!modelId || modelId === AUTO_MODEL_ID || seen.has(modelId)) continue;
    seen.add(modelId);
    unique.push(modelId);
  }
  return unique;
}

function shouldFallbackToNextModel(error) {
  const message = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
  return (
    // Treat "model can't be used as requested" as a reason to try another candidate.
    (message.includes('model') || message.includes('inference profile') || message.includes('throughput')) &&
    (message.includes('invalid') ||
      message.includes('not found') ||
      message.includes('unsupported') ||
      message.includes("on-demand throughput isn’t supported") ||
      message.includes("on-demand throughput isn't supported") ||
      message.includes('inference profile') ||
      message.includes('provisioned') ||
      message.includes('access denied') ||
      message.includes('not authorized'))
  );
}

export async function invokeBedrockWithModelFallback({
  requestedModelId,
  defaultModelId,
  systemPrompt,
  userPrompt
}) {
  let discoveredModels = [];
  try {
    discoveredModels = await listAvailableTextModels();
  } catch (error) {
    // If model discovery fails, still try explicitly requested/configured models.
    discoveredModels = [];
  }

  const candidateIds = toUniqueCandidateIds([
    requestedModelId,
    defaultModelId,
    ...discoveredModels.map((model) => model.id)
  ]);

  if (!candidateIds.length) {
    const modelResolutionError = new Error(
      'No Bedrock text models available. Grant model access in this region or set BEDROCK_MODEL_ID.'
    );
    modelResolutionError.name = 'ModelResolutionError';
    throw modelResolutionError;
  }

  let lastError = null;
  for (const modelId of candidateIds) {
    try {
      const content = await invokeBedrock({ modelId, systemPrompt, userPrompt });
      return { content, modelId };
    } catch (error) {
      lastError = error;
      if (!shouldFallbackToNextModel(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Unable to invoke Bedrock with any candidate model');
}

export async function invokeBedrock({ modelId, systemPrompt, userPrompt }) {
  const command = new ConverseCommand({
    modelId,
    system: [{ text: systemPrompt }],
    messages: [
      {
        role: 'user',
        content: [{ text: userPrompt }]
      }
    ]
  });

  const response = await bedrockClient.send(command);
  return normalizeTextFromConverseOutput(response.output);
}
