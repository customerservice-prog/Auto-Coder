import { describe, it, expect } from 'vitest';
import { runAgent } from './agent.js';

describe('@auto-coder/ai-core', () => {
  it('exports runAgent', () => {
    expect(typeof runAgent).toBe('function');
  });
});
