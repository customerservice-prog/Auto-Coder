/**
 * Env presence for models used by `POST /api/agent` (`selectWebModel`).
 * Does not validate key correctness — only that at least one provider is configured.
 */
export function hasAgentLlmApiKeysConfigured(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.OPENAI_API_KEY?.trim() ||
      process.env.DEEPSEEK_API_KEY?.trim()
  );
}
