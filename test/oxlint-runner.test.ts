import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { OxlintRunner } from '../src/oxlint-runner.js';

vi.mock('child_process');
vi.mock('fs');

describe('OxlintRunner', () => {
  const mockSpawn = vi.mocked(spawn);
  const mockExistsSync = vi.mocked(existsSync);

  beforeEach(() => {
    // Mock existsSync to return false so detectPackageManager falls back to 'oxlint'
    mockExistsSync.mockReturnValue(false);
  });

  it('should parse oxlint JSON output correctly', async () => {
    const mockStdout = JSON.stringify({
      'src/test.ts': [
        {
          severity: 'error',
          message: 'Unused variable',
          rule_id: 'no-unused-vars',
          labels: [
            {
              span: { start: 10, end: 15 },
              message: 'unused variable'
            }
          ],
          help: 'Remove the unused variable'
        }
      ]
    });

    const mockProcess = {
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(mockStdout));
          }
        })
      },
      stderr: {
        on: vi.fn()
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          callback(1); // oxlint exits with 1 when issues found
        }
      })
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    const runner = new OxlintRunner();
    const result = await runner.run(['src/']);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      filename: 'src/test.ts',
      rule: 'no-unused-vars',
      severity: 'error',
      message: 'Unused variable',
      help: 'Remove the unused variable',
      line: 10,
      column: 5
    });

    expect(mockSpawn).toHaveBeenCalledWith('oxlint', ['-f', 'json', 'src/'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
  });

  it('should handle empty output', async () => {
    const mockProcess = {
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(''));
          }
        })
      },
      stderr: {
        on: vi.fn()
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      })
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    const runner = new OxlintRunner();
    const result = await runner.run();

    expect(result).toEqual([]);
  });

  it('should handle missing rule_id', async () => {
    const mockStdout = JSON.stringify({
      'src/test.ts': [
        {
          severity: 'warning',
          message: 'Some warning',
          labels: []
        }
      ]
    });

    const mockProcess = {
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') {
            callback(Buffer.from(mockStdout));
          }
        })
      },
      stderr: {
        on: vi.fn()
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          callback(0);
        }
      })
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    const runner = new OxlintRunner();
    const result = await runner.run();

    expect(result[0].rule).toBe('unknown');
    expect(result[0].severity).toBe('warning');
  });

  it('should reject on process error', async () => {
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'error') {
          callback(new Error('Command not found'));
        }
      })
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    const runner = new OxlintRunner();

    await expect(runner.run()).rejects.toThrow('Failed to run oxlint: Command not found');
  });
});