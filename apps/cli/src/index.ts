#!/usr/bin/env node
/**
 * Auto-Coder CLI — Headless autonomous agent mode.
 * Usage: autocoder run "build a REST API for user auth" --path ./my-project
 * Usage: autocoder run "add tests" --path . --model claude --hours 2
 */
import { program } from 'commander';
import { runAgent, orchestrate } from '@auto-coder/ai-core';
import { indexCodebase } from '@auto-coder/indexer';
import path from 'path';
import chalk from 'chalk';

program
  .name('autocoder')
  .description('Autonomous AI coding agent — CLI mode')
  .version('0.1.0');

program
  .command('run <mission>')
  .description('Run the autonomous agent on a mission')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-m, --model <model>', 'AI model: claude | gpt4o | deepseek', 'claude')
  .option('--multi-agent', 'Use multi-agent orchestration mode', false)
  .option('--max-iterations <n>', 'Maximum agent iterations', '50')
  .option('--webhook <url>', 'Webhook URL for progress updates')
  .action(async (mission, options) => {
    const projectPath = path.resolve(options.path);

    console.log(chalk.cyan('\n🚀 Auto-Coder CLI'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(chalk.white('Mission:'), chalk.yellow(mission));
    console.log(chalk.white('Project:'), chalk.gray(projectPath));
    console.log(chalk.white('Model:  '), chalk.gray(options.model));
    console.log(chalk.gray('─'.repeat(50) + '\n'));

    // Index the codebase first
    console.log(chalk.blue('⚡ Indexing codebase...'));
    const chunks = await indexCodebase({ projectPath });
    console.log(chalk.green(`✓ Indexed ${chunks.length} code chunks\n`));

    if (options.multiAgent) {
      console.log(chalk.blue('🔀 Running in multi-agent mode...\n'));
      await orchestrate(mission, {
        projectPath,
        useWorktrees: false,
        onTaskUpdate: (task) => {
          const icon = task.status === 'done' ? '✓' : task.status === 'failed' ? '✗' : '◐';
          const color = task.status === 'done' ? chalk.green : task.status === 'failed' ? chalk.red : chalk.yellow;
          console.log(color(`  ${icon} [${task.specialist.toUpperCase()}] ${task.status.toUpperCase()}`));
        },
      });
    } else {
      await runAgent(mission, {
        model: options.model as any,
        projectPath,
        maxIterations: parseInt(options.maxIterations),
        onStatusChange: (status, message) => {
          const icons: Record<string, string> = {
            idle: '○', planning: '◐', executing: '◑', testing: '◒', done: '✓', error: '✗',
          };
          const colors: Record<string, any> = {
            idle: chalk.gray, planning: chalk.yellow, executing: chalk.blue,
            testing: chalk.magenta, done: chalk.green, error: chalk.red,
          };
          const color = colors[status] || chalk.white;
          console.log(color(`[${icons[status] || '·'}] ${status.toUpperCase()}: ${message}`));

          // Send webhook if configured
          if (options.webhook) {
            fetch(options.webhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status, message, projectPath, mission }),
            }).catch(() => {});
          }
        },
        onFileChange: (filePath) => {
          console.log(chalk.gray(`  → Modified: ${filePath}`));
        },
      });
    }

    console.log(chalk.green('\n✅ Mission complete! Check PLAN.md for the full execution log.'));
    process.exit(0);
  });

program
  .command('index')
  .description('Index a codebase for AI context')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options) => {
    const projectPath = path.resolve(options.path);
    console.log(chalk.blue('⚡ Indexing...'));
    const chunks = await indexCodebase({ projectPath });
    console.log(chalk.green(`✓ ${chunks.length} chunks indexed from ${projectPath}`));
  });

program.parse();
