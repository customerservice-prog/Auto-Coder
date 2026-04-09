import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hasAgentLlmApiKeysConfigured } from '@/lib/agent-llm-env';

const KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY'] as const;

describe('hasAgentLlmApiKeysConfigured', () => {
  const original: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

  for (const k of KEYS) {
    original[k] = process.env[k];
  }

  afterAll(() => {
    for (const k of KEYS) {
      const v = original[k];
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  beforeEach(() => {
    for (const k of KEYS) {
      delete process.env[k];
    }
  });

  it('is false when all are unset', () => {
    expect(hasAgentLlmApiKeysConfigured()).toBe(false);
  });

  it.each(KEYS)('is true when %s is set', (k) => {
    process.env[k] = 'sk-test';
    expect(hasAgentLlmApiKeysConfigured()).toBe(true);
  });
});
