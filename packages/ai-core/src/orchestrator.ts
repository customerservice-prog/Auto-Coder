import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { runAgent, AgentOptions } from './agent.js';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface SubTask {
  id: string;
  specialist: 'frontend' | 'backend' | 'database' | 'tests' | 'docs';
  mission: string;
  worktree?: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: string;
}

export interface OrchestratorOptions {
  projectPath: string;
  onTaskUpdate?: (task: SubTask) => void;
  useWorktrees?: boolean;
}

/**
 * Mission Control — breaks a high-level mission into subtasks,
 * spawns specialist agents in parallel, and merges the results.
 */
export async function orchestrate(
  mission: string,
  options: OrchestratorOptions
): Promise<void> {
  const { projectPath, onTaskUpdate, useWorktrees = false } = options;

  console.log('[Orchestrator] Breaking mission into subtasks...');

  // Step 1: Coordinator agent plans the subtasks
  const planResult = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    system: `You are a software project coordinator. Break down the given mission into parallel subtasks for specialist engineers.
Return a JSON array of subtasks. Each subtask must have:
- id: unique string
- specialist: one of "frontend" | "backend" | "database" | "tests" | "docs"  
- mission: specific actionable mission for that specialist

Keep it to 2-4 subtasks maximum. Be specific and non-overlapping.`,
    prompt: `Project: ${projectPath}
Mission: ${mission}

Return only valid JSON array.`,
  });

  let subtasks: SubTask[];
  try {
    const jsonMatch = planResult.text.match(/[[sS]*]/);
    subtasks = jsonMatch
      ? JSON.parse(jsonMatch[0]).map((t: any) => ({ ...t, status: 'pending' }))
      : [];
  } catch {
    console.error('[Orchestrator] Failed to parse subtask plan, running as single agent');
    await runAgent(mission, { projectPath });
    return;
  }

  console.log(`[Orchestrator] Spawning ${subtasks.length} specialist agents...`);

  // Step 2: Optionally create git worktrees for isolation
  if (useWorktrees) {
    for (const task of subtasks) {
      const worktreePath = path.join(projectPath, `.worktrees/${task.specialist}`);
      try {
        execSync(`git worktree add "${worktreePath}" -b "agent/${task.specialist}-${Date.now()}"`, {
          cwd: projectPath,
          stdio: 'pipe',
        });
        task.worktree = worktreePath;
      } catch {
        task.worktree = projectPath; // Fallback to main
      }
    }
  }

  // Step 3: Run specialist agents in parallel
  const agentPromises = subtasks.map(async (task) => {
    task.status = 'running';
    onTaskUpdate?.(task);

    try {
      const agentPath = task.worktree || projectPath;
      await runAgent(task.mission, {
        projectPath: agentPath,
        onStatusChange: (status, msg) => {
          console.log(`[${task.specialist.toUpperCase()}] ${status}: ${msg}`);
        },
      });

      task.status = 'done';
      task.result = 'Completed successfully';
    } catch (err) {
      task.status = 'failed';
      task.result = String(err);
    }

    onTaskUpdate?.(task);
    return task;
  });

  await Promise.all(agentPromises);

  // Step 4: If using worktrees, merge results back
  if (useWorktrees) {
    for (const task of subtasks) {
      if (task.status === 'done' && task.worktree && task.worktree !== projectPath) {
        try {
          execSync(`git merge "agent/${task.specialist}" --no-ff -m "Merge ${task.specialist} agent changes"`, {
            cwd: projectPath,
            stdio: 'pipe',
          });
        } catch (err) {
          console.warn(`[Orchestrator] Could not auto-merge ${task.specialist}:`, err);
        }
      }
    }
  }

  console.log('[Orchestrator] All agents complete. Mission done.');
}

/**
 * Multi-model evaluator — runs the same task on multiple models,
 * scores each result, and returns the best solution.
 */
export async function evaluateWithMultipleModels(
  task: string,
  projectPath: string
): Promise<{ bestModel: string; bestCode: string; scores: Record<string, number> }> {
  const models = [
    { name: 'claude', model: anthropic('claude-sonnet-4-5') },
  ];

  const results = await Promise.all(
    models.map(async ({ name, model }) => {
      try {
        const result = await generateText({
          model,
          system: 'You are an expert software engineer. Write clean, efficient, well-typed TypeScript code.',
          prompt: task,
          maxTokens: 2000,
        });
        return { name, code: result.text };
      } catch {
        return { name, code: '' };
      }
    })
  );

  // Score each result (basic heuristics — extend with AST analysis)
  const scores: Record<string, number> = {};
  for (const { name, code } of results) {
    let score = 0;
    if (code.includes('try')) score += 10; // Error handling
    if (code.includes(': ') && code.includes('interface')) score += 15; // TypeScript types
    if (!code.includes('any')) score += 10; // No 'any' types
    if (code.includes('// ') || code.includes('/*')) score += 5; // Comments
    score += Math.min(code.length / 100, 20); // Completeness
    scores[name] = score;
  }

  const bestName = Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0];
  const best = results.find((r) => r.name === bestName)!;

  return { bestModel: bestName, bestCode: best.code, scores };
}
