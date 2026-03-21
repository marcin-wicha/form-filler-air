import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

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
