import { generateText, tool, CoreMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createOpenAI, openai } from '@ai-sdk/openai';

const deepseekProvider = createOpenAI({
  baseURL: 'https://api.deepseek.com/v1',
});
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { getMemory, saveMemory } from './memory.js';

const execAsync = promisify(exec);

export type AgentModel = 'claude' | 'gpt4o' | 'deepseek';
export type AgentStatus = 'idle' | 'planning' | 'executing' | 'testing' | 'done' | 'error';

export interface AgentOptions {
  model?: AgentModel;
  projectPath: string;
  onStatusChange?: (status: AgentStatus, message: string) => void;
  onFileChange?: (filePath: string, content: string) => void;
  maxIterations?: number;
}

export interface AgentResult {
  success: boolean;
  filesChanged: string[];
  planMd: string;
  error?: string;
  iterations: number;
}

/**
 * Core autonomous agent — plans, executes, tests, and self-heals.
 * This is the beating heart of Auto-Coder.
 */
export async function runAgent(
  mission: string,
  options: AgentOptions
): Promise<AgentResult> {
  const {
    model = 'claude',
    projectPath,
    onStatusChange,
    onFileChange,
    maxIterations = 50,
  } = options;

  const sessionId = uuidv4();
  const filesChanged: string[] = [];
  let iterations = 0;

  // Load project memory
  const memory = await getMemory(projectPath);

  // Initialize PLAN.md
  const planPath = path.join(projectPath, 'PLAN.md');
  const initialPlan = `# Auto-Coder Mission Log
**Session:** ${sessionId}
**Started:** ${new Date().toISOString()}
**Objective:** ${mission}

## Steps
- [ ] Analyzing codebase...

## Memory Context
${memory.slice(0, 500)}
`;
  await fs.writeFile(planPath, initialPlan);
  if (!filesChanged.includes('PLAN.md')) filesChanged.push('PLAN.md');
  onFileChange?.('PLAN.md', initialPlan);
  onStatusChange?.('planning', 'Initializing mission and analyzing codebase...');

  // Select AI model
  const aiModel =
    model === 'claude'
      ? anthropic('claude-sonnet-4-5')
      : model === 'gpt4o'
        ? openai('gpt-4o')
        : deepseekProvider('deepseek-chat');

  const messages: CoreMessage[] = [];

  const systemPrompt = `You are an autonomous senior software engineer. You have full access to the filesystem and terminal.

MISSION: ${mission}
PROJECT: ${projectPath}
SESSION: ${sessionId}

## Protocol
1. ALWAYS start by reading key files to understand the codebase architecture
2. Create/update PLAN.md with your step-by-step plan before executing
3. Make changes incrementally — write, then verify
4. After ALL changes, run tests. Fix failures before marking done
5. Update PLAN.md checkboxes as you complete steps
6. Only stop for input if there is genuine architectural ambiguity

## Constraints
- Never delete files without explicit instruction
- Always write TypeScript with proper types
- Follow existing code style and patterns
- Keep imports clean — no unused imports

## Memory Context
${memory}
`;

  // Agentic loop
  while (iterations < maxIterations) {
    iterations++;
    onStatusChange?.('executing', `Iteration ${iterations}...`);

    try {
      const result = await generateText({
        model: aiModel,
        system: systemPrompt,
        messages,
        maxSteps: 20,
        tools: buildTools(projectPath, filesChanged, onFileChange, onStatusChange),
      });

      messages.push({ role: 'assistant', content: result.text });

      // Check if agent signaled completion
      if (
        result.text.toLowerCase().includes('[mission complete]') ||
        result.text.toLowerCase().includes('[done]') ||
        result.finishReason === 'stop'
      ) {
        onStatusChange?.('done', 'Mission complete!');
        break;
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      onStatusChange?.('error', `Error on iteration ${iterations}: ${errorMsg}`);

      // Self-correction: tell agent about the error
      messages.push({
        role: 'user',
        content: `Error occurred: ${errorMsg}. Analyze what went wrong, adjust your approach, and continue.`,
      });
    }
  }

  // Save memory for next session
  await saveMemory(projectPath, mission, filesChanged);

  // Final PLAN.md update
  const finalPlan = await fs.readFile(planPath, 'utf-8').catch(() => initialPlan);
  const updatedPlan = finalPlan + `

---
**Completed:** ${new Date().toISOString()}
**Iterations:** ${iterations}
**Files Changed:** ${filesChanged.join(', ')}`;
  await fs.writeFile(planPath, updatedPlan);
  if (!filesChanged.includes('PLAN.md')) filesChanged.push('PLAN.md');
  onFileChange?.('PLAN.md', updatedPlan);

  return {
    success: true,
    filesChanged,
    planMd: updatedPlan,
    iterations,
  };
}

function buildTools(
  projectPath: string,
  filesChanged: string[],
  onFileChange?: (path: string, content: string) => void,
  onStatusChange?: (status: AgentStatus, message: string) => void
) {
  return {
    read_file: tool({
      description: 'Read the contents of a file in the project',
      parameters: z.object({
        path: z.string().describe('Relative path from project root'),
      }),
      execute: async ({ path: filePath }) => {
        try {
          const fullPath = path.join(projectPath, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          return { success: true, content };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),

    write_file: tool({
      description: 'Write or create a file in the project',
      parameters: z.object({
        path: z.string().describe('Relative path from project root'),
        content: z.string().describe('Full file content to write'),
      }),
      execute: async ({ path: filePath, content }) => {
        try {
          const fullPath = path.join(projectPath, filePath);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content);
          if (!filesChanged.includes(filePath)) filesChanged.push(filePath);
          onFileChange?.(filePath, content);
          return { success: true, path: filePath };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),

    list_files: tool({
      description: 'List files in a directory',
      parameters: z.object({
        directory: z.string().default('.').describe('Directory relative to project root'),
        recursive: z.boolean().default(false),
      }),
      execute: async ({ directory, recursive }) => {
        try {
          const fullPath = path.join(projectPath, directory);
          const lines = await listProjectFiles(projectPath, fullPath, recursive, 100);
          return { success: true, output: lines.join('\n') };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),

    run_terminal: tool({
      description: 'Run a shell command in the project directory',
      parameters: z.object({
        command: z.string().describe('Shell command to execute'),
        cwd: z.string().optional().describe('Working directory (relative to project root)'),
      }),
      execute: async ({ command, cwd }) => {
        onStatusChange?.('executing', `Running: ${command}`);
        try {
          const workDir = cwd
            ? path.join(projectPath, cwd)
            : projectPath;
          const { stdout, stderr } = await execAsync(command, {
            cwd: workDir,
            timeout: 60000,
            env: { ...process.env, NODE_ENV: 'test' },
          });
          return { success: true, stdout, stderr };
        } catch (err: any) {
          return {
            success: false,
            stdout: err.stdout || '',
            stderr: err.stderr || String(err),
            exitCode: err.code,
          };
        }
      },
    }),

    search_codebase: tool({
      description: 'Search the codebase for a pattern or text',
      parameters: z.object({
        query: z.string().describe('Search query or pattern'),
        filePattern: z.string().optional().describe('File glob pattern (e.g. "*.ts")'),
      }),
      execute: async ({ query, filePattern }) => {
        try {
          const matches = await searchFilesInProject(projectPath, query, filePattern);
          return { success: true, matches };
        } catch {
          return { success: true, matches: [] };
        }
      },
    }),

    update_plan: tool({
      description: 'Update the PLAN.md file with progress',
      parameters: z.object({
        content: z.string().describe('Full updated content for PLAN.md'),
      }),
      execute: async ({ content }) => {
        try {
          await fs.writeFile(path.join(projectPath, 'PLAN.md'), content);
          if (!filesChanged.includes('PLAN.md')) filesChanged.push('PLAN.md');
          onFileChange?.('PLAN.md', content);
          return { success: true };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),

    run_tests: tool({
      description: 'Run the project test suite and return results',
      parameters: z.object({
        testCommand: z.string().default('pnpm test').describe('Test command to run'),
      }),
      execute: async ({ testCommand }) => {
        onStatusChange?.('testing', 'Running test suite...');
        try {
          const { stdout, stderr } = await execAsync(testCommand, {
            cwd: projectPath,
            timeout: 120000,
          });
          return { success: true, output: stdout + stderr };
        } catch (err: any) {
          return {
            success: false,
            output: (err.stdout || '') + (err.stderr || ''),
            exitCode: err.code,
          };
        }
      },
    }),

    instrument_code: tool({
      description: 'Add temporary debugging instrumentation to a file to diagnose issues',
      parameters: z.object({
        filePath: z.string(),
        instrumentationCode: z.string().describe('Logging/telemetry code to inject'),
        lineNumber: z.number().describe('Line number to inject after'),
      }),
      execute: async ({ filePath, instrumentationCode, lineNumber }) => {
        try {
          const fullPath = path.join(projectPath, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          const idx = Math.max(0, Math.min(lines.length, lineNumber));
          lines.splice(idx, 0, instrumentationCode);
          const newContent = lines.join('\n');
          await fs.writeFile(fullPath, newContent);
          if (!filesChanged.includes(filePath)) filesChanged.push(filePath);
          onFileChange?.(filePath, newContent);
          return { success: true, message: `Instrumented ${filePath} at line ${lineNumber}` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),
  };
}

const IGNORE_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  '.turbo',
  '.cursor',
  '.auto-coder-memory',
]);

async function listProjectFiles(
  projectRoot: string,
  dir: string,
  recursive: boolean,
  maxFiles: number
): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [dir];
  while (stack.length && out.length < maxFiles) {
    const current = stack.pop()!;
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (out.length >= maxFiles) break;
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        if (IGNORE_DIR_NAMES.has(e.name)) continue;
        if (recursive) stack.push(full);
        out.push(path.relative(projectRoot, full) + path.sep);
      } else {
        out.push(path.relative(projectRoot, full));
      }
    }
  }
  return out.sort();
}

function matchGlob(filename: string, pattern: string | undefined): boolean {
  if (!pattern) return true;
  const ext = pattern.startsWith('*.') ? pattern.slice(1) : pattern;
  if (ext.startsWith('.')) return filename.endsWith(ext);
  return filename === pattern;
}

async function searchFilesInProject(
  projectRoot: string,
  query: string,
  filePattern: string | undefined
): Promise<string[]> {
  const matches = new Set<string>();
  const q = query.toLowerCase();

  async function walk(dir: string): Promise<void> {
    if (matches.size >= 20) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (matches.size >= 20) break;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (IGNORE_DIR_NAMES.has(e.name)) continue;
        await walk(full);
      } else {
        if (!matchGlob(e.name, filePattern)) continue;
        const rel = path.relative(projectRoot, full);
        try {
          const text = await fs.readFile(full, 'utf-8');
          if (text.toLowerCase().includes(q)) matches.add(rel);
        } catch {
          /* binary or unreadable */
        }
      }
    }
  }

  await walk(projectRoot);
  return [...matches];
}
