import { generateText, streamText, tool, CoreMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { execSync, exec } from 'child_process';
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
  onStatusChange?.('planning', 'Initializing mission and analyzing codebase...');

  // Select AI model
  const aiModel = model === 'claude'
    ? anthropic('claude-sonnet-4-5')
    : model === 'gpt4o'
    ? openai('gpt-4o')
    : openai('deepseek-chat', { baseURL: 'https://api.deepseek.com/v1' });

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
          const cmd = recursive
            ? `find "${fullPath}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" | head -100`
            : `ls -la "${fullPath}"`;
          const { stdout } = await execAsync(cmd);
          return { success: true, output: stdout };
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
          const pattern = filePattern ? `--include="${filePattern}"` : '';
          const cmd = `grep -r ${pattern} --include="*.ts" --include="*.tsx" --include="*.js" -l "${query}" "${projectPath}" | grep -v node_modules | grep -v .git | head -20`;
          const { stdout } = await execAsync(cmd);
          return { success: true, matches: stdout.split('
').filter(Boolean) };
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
          const lines = content.split('
');
          lines.splice(lineNumber, 0, instrumentationCode);
          await fs.writeFile(fullPath, lines.join('
'));
          return { success: true, message: `Instrumented ${filePath} at line ${lineNumber}` };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      },
    }),
  };
}
