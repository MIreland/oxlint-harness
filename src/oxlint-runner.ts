import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname, parse } from 'path';
import { OxlintOutput, ProcessedDiagnostic } from './types.js';

export class OxlintRunner {
  private findLockFile(startDir: string): string | null {
    let currentDir = startDir;
    const root = parse(currentDir).root;

    while (currentDir !== root) {
      // Check for lock files in order of preference
      const lockFiles = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'];

      for (const lockFile of lockFiles) {
        if (existsSync(resolve(currentDir, lockFile))) {
          return resolve(currentDir, lockFile);
        }
      }

      // Move up one directory
      const parent = dirname(currentDir);
      if (parent === currentDir) break; // Reached filesystem root
      currentDir = parent;
    }

    return null;
  }

  private detectPackageManager(): { command: string; args: string[] } {
    const cwd = process.cwd();
    const lockFile = this.findLockFile(cwd);

    if (lockFile) {
      const lockFileName = parse(lockFile).base;

      if (lockFileName === 'pnpm-lock.yaml') {
        return { command: 'pnpm', args: ['exec', 'oxlint'] };
      }

      if (lockFileName === 'yarn.lock') {
        return { command: 'yarn', args: ['exec', 'oxlint'] };
      }

      if (lockFileName === 'package-lock.json') {
        return { command: 'npx', args: ['oxlint'] };
      }
    }

    // Fallback to direct oxlint if no lock file found
    return { command: 'oxlint', args: [] };
  }

  async run(args: string[] = []): Promise<ProcessedDiagnostic[]> {
    const packageManager = this.detectPackageManager();

    const finalArgs = [...packageManager.args, '-f', 'json', ...args];

    return new Promise((resolve, reject) => {
      const process = spawn(packageManager.command, finalArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        try {
          // oxlint exits with non-zero when linting issues are found
          // We still want to parse the JSON output
          const diagnostics = this.parseOxlintOutput(stdout);
          resolve(diagnostics);
        } catch (error) {
          reject(new Error(`Failed to parse oxlint output: ${error instanceof Error ? error.message : String(error)}\nStdout: ${stdout}\nStderr: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to run ${packageManager.command}: ${error.message}`));
      });
    });
  }

  private parseOxlintOutput(output: string): ProcessedDiagnostic[] {
    if (!output.trim()) {
      return [];
    }

    try {
      const parsed = JSON.parse(output);
      const diagnostics: ProcessedDiagnostic[] = [];

      // Handle the new oxlint JSON format with diagnostics array
      if (parsed.diagnostics && Array.isArray(parsed.diagnostics)) {
        for (const diagnostic of parsed.diagnostics) {
          const processed: ProcessedDiagnostic = {
            filename: diagnostic.filename || 'unknown',
            rule: diagnostic.code || 'unknown',
            severity: diagnostic.severity,
            message: diagnostic.message,
            help: diagnostic.help,
            url: diagnostic.url
          };

          // Extract line/column from labels if available
          if (diagnostic.labels && diagnostic.labels.length > 0) {
            const firstLabel = diagnostic.labels[0];
            if (firstLabel.span) {
              processed.line = firstLabel.span.line;
              processed.column = firstLabel.span.column;
            }
          }

          diagnostics.push(processed);
        }
      }
      // Fallback to old format if needed
      else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [filename, fileDiagnostics] of Object.entries(parsed)) {
          if (Array.isArray(fileDiagnostics)) {
            for (const diagnostic of fileDiagnostics as any[]) {
              const processed: ProcessedDiagnostic = {
                filename,
                rule: diagnostic.rule_id || diagnostic.code || 'unknown',
                severity: diagnostic.severity,
                message: diagnostic.message,
                help: diagnostic.help,
                url: diagnostic.url
              };

              if (diagnostic.labels && diagnostic.labels.length > 0) {
                const firstLabel = diagnostic.labels[0];
                if (firstLabel.span) {
                  processed.line = firstLabel.span.line || firstLabel.span.start;
                  processed.column = firstLabel.span.column || (firstLabel.span.end - firstLabel.span.start);
                }
              }

              diagnostics.push(processed);
            }
          }
        }
      }

      return diagnostics;
    } catch (error) {
      throw new Error(`Invalid JSON output: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}