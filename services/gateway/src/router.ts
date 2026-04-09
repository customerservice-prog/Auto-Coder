/**
 * AI Model Router — routes requests to the best model based on task type.
 * Handles rate limiting, fallback, and cost optimization.
 */
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI, openai } from '@ai-sdk/openai';

const deepseekProvider = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1',
});
import { generateText, LanguageModel } from 'ai';

export type ModelName = 'claude' | 'gpt4o' | 'deepseek' | 'auto';
export type TaskType = 'code' | 'plan' | 'review' | 'autocomplete' | 'debug';

interface RouterConfig {
  model: ModelName;
  task?: TaskType;
}

/**
 * Select the best model for a given task.
 * 'auto' mode picks the optimal model based on task type.
 */
export function selectModel(config: RouterConfig): LanguageModel {
  const { model, task } = config;

  if (model !== 'auto') {
    return resolveModel(model);
  }

  // Auto-routing logic based on task type
  switch (task) {
    case 'autocomplete':
      // Use faster/cheaper model for autocomplete
      return openai('gpt-4o-mini');
    case 'plan':
      // Claude excels at planning and reasoning
      return anthropic('claude-sonnet-4-5');
    case 'review':
      // GPT-4o is strong at code review
      return openai('gpt-4o');
    case 'debug':
      // Claude is best for debugging complex issues
      return anthropic('claude-sonnet-4-5');
    case 'code':
    default:
      return anthropic('claude-sonnet-4-5');
  }
}

function resolveModel(name: ModelName): LanguageModel {
  switch (name) {
    case 'claude':
      return anthropic('claude-sonnet-4-5');
    case 'gpt4o':
      return openai('gpt-4o');
    case 'deepseek':
      return deepseekProvider('deepseek-chat');
    default:
      return anthropic('claude-sonnet-4-5');
  }
}

/**
 * Route a completion request through the gateway with fallback.
 */
export async function routeCompletion(
  prompt: string,
  config: RouterConfig & { system?: string; maxTokens?: number }
): Promise<string> {
  const model = selectModel(config);

  try {
    const result = await generateText({
      model,
      system: config.system,
      prompt,
      maxTokens: config.maxTokens || 2048,
    });
    return result.text;
  } catch (err) {
    console.warn('[Gateway] Primary model failed, falling back to Claude:', err);
    // Fallback to Claude
    const fallback = anthropic('claude-sonnet-4-5');
    const result = await generateText({
      model: fallback,
      system: config.system,
      prompt,
      maxTokens: config.maxTokens || 2048,
    });
    return result.text;
  }
}
