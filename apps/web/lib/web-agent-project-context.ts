import type { WebWorkspaceRepoMeta } from '@/lib/web-workspace-repo';
import { AGENT_PROJECT_CONTEXT_MAX_CHARS } from '@/lib/agent-api-limits';

/** Builds optional `projectContext` for POST /api/agent from linked repo + notes. */
export function buildAgentProjectContext(meta: WebWorkspaceRepoMeta): string | undefined {
  const url = meta.repoUrl.trim();
  const label = meta.repoLabel.trim();
  const notes = meta.repoNotes.trim();
  const parts: string[] = [];
  if (url || label) {
    const head = '## Linked repository';
    const lines = [head];
    if (label) lines.push(`Label: ${label}`);
    if (url) lines.push(`URL: ${url}`);
    parts.push(lines.join('\n'));
  }
  if (notes) {
    parts.push(`## Workspace notes\n${notes}`);
  }
  let out = parts.join('\n\n').trim();
  if (!out) return undefined;
  if (out.length > AGENT_PROJECT_CONTEXT_MAX_CHARS) {
    out = `${out.slice(0, AGENT_PROJECT_CONTEXT_MAX_CHARS)}\n\n…(truncated)`;
  }
  return out;
}
