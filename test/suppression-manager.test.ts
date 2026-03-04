import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import { SuppressionManager } from '../src/suppression-manager.js';
import { ProcessedDiagnostic, SuppressionFile } from '../src/types.js';

describe('SuppressionManager', () => {
  const testFile = './test-suppressions.json';
  let manager: SuppressionManager;

  beforeEach(() => {
    manager = new SuppressionManager(testFile);
  });

  afterEach(() => {
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  describe('loadSuppressions', () => {
    it('should return empty object when file does not exist', () => {
      const suppressions = manager.loadSuppressions();
      expect(suppressions).toEqual({});
    });

    it('should load existing suppression file', () => {
      const testSuppressions = {
        'src/test.ts': {
          'no-unused-vars': { count: 2 },
          'prefer-const': { count: 1 }
        }
      };

      manager.saveSuppressions(testSuppressions);
      const loaded = manager.loadSuppressions();

      expect(loaded).toEqual(testSuppressions);
    });
  });

  describe('generateSuppressions', () => {
    it('should generate suppressions from diagnostics', () => {
      const diagnostics: ProcessedDiagnostic[] = [
        {
          filename: 'src/test.ts',
          rule: 'no-unused-vars',
          severity: 'error',
          message: 'Unused variable'
        },
        {
          filename: 'src/test.ts',
          rule: 'no-unused-vars',
          severity: 'error',
          message: 'Another unused variable'
        },
        {
          filename: 'src/test.ts',
          rule: 'prefer-const',
          severity: 'error',
          message: 'Should use const'
        },
        {
          filename: 'src/other.ts',
          rule: 'no-var',
          severity: 'error',
          message: 'No var allowed'
        }
      ];

      const suppressions = manager.generateSuppressions(diagnostics);

      expect(suppressions).toEqual({
        'src/test.ts': {
          'no-unused-vars': { count: 2 },
          'prefer-const': { count: 1 }
        },
        'src/other.ts': {
          'no-var': { count: 1 }
        }
      });
    });
  });

  describe('findExcessErrors', () => {
    it('should find no excess errors when counts match', () => {
      const diagnostics: ProcessedDiagnostic[] = [
        {
          filename: 'src/test.ts',
          rule: 'no-unused-vars',
          severity: 'error',
          message: 'Unused variable'
        }
      ];

      const suppressions = {
        'src/test.ts': {
          'no-unused-vars': { count: 1 }
        }
      };

      const excess = manager.findExcessErrors(diagnostics, suppressions);
      expect(excess).toEqual([]);
    });

    it('should find excess errors when actual exceeds suppressed', () => {
      const diagnostics: ProcessedDiagnostic[] = [
        {
          filename: 'src/test.ts',
          rule: 'no-unused-vars',
          severity: 'error',
          message: 'Unused variable 1'
        },
        {
          filename: 'src/test.ts',
          rule: 'no-unused-vars',
          severity: 'error',
          message: 'Unused variable 2'
        },
        {
          filename: 'src/test.ts',
          rule: 'no-unused-vars',
          severity: 'error',
          message: 'Unused variable 3'
        }
      ];

      const suppressions = {
        'src/test.ts': {
          'no-unused-vars': { count: 1 }
        }
      };

      const excess = manager.findExcessErrors(diagnostics, suppressions);

      expect(excess).toHaveLength(1);
      expect(excess[0]).toEqual({
        rule: 'no-unused-vars',
        filename: 'src/test.ts',
        expected: 1,
        actual: 3,
        diagnostics: diagnostics
      });
    });

    it('should handle unsuppressed rules as excess', () => {
      const diagnostics: ProcessedDiagnostic[] = [
        {
          filename: 'src/test.ts',
          rule: 'new-rule',
          severity: 'error',
          message: 'New error'
        }
      ];

      const suppressions = {};

      const excess = manager.findExcessErrors(diagnostics, suppressions);

      expect(excess).toHaveLength(1);
      expect(excess[0].expected).toBe(0);
      expect(excess[0].actual).toBe(1);
    });
  });

  describe('tightenSuppressions', () => {
    it('should reduce count when violations decrease', () => {
      const current: SuppressionFile = {
        'src/test.ts': {
          'no-unused-vars': { count: 5 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [
        { filename: 'src/test.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 1' },
        { filename: 'src/test.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 2' },
        { filename: 'src/test.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 3' }
      ];

      const result = manager.tightenSuppressions(current, diagnostics);

      expect(result).toEqual({
        'src/test.ts': {
          'no-unused-vars': { count: 3 }
        }
      });
    });

    it('should remove a rule when all its violations are fixed', () => {
      const current: SuppressionFile = {
        'src/test.ts': {
          'no-unused-vars': { count: 2 },
          'prefer-const': { count: 1 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [
        { filename: 'src/test.ts', rule: 'prefer-const', severity: 'error', message: 'Use const' }
      ];

      const result = manager.tightenSuppressions(current, diagnostics);

      expect(result).toEqual({
        'src/test.ts': {
          'prefer-const': { count: 1 }
        }
      });
    });

    it('should remove entire file entry when all its rules are resolved', () => {
      const current: SuppressionFile = {
        'src/test.ts': {
          'no-unused-vars': { count: 2 },
          'prefer-const': { count: 1 }
        },
        'src/other.ts': {
          'no-var': { count: 1 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [
        { filename: 'src/other.ts', rule: 'no-var', severity: 'error', message: 'No var' }
      ];

      const result = manager.tightenSuppressions(current, diagnostics);

      expect(result).toEqual({
        'src/other.ts': {
          'no-var': { count: 1 }
        }
      });
    });

    it('should keep count unchanged when violations match', () => {
      const current: SuppressionFile = {
        'src/test.ts': {
          'no-unused-vars': { count: 2 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [
        { filename: 'src/test.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 1' },
        { filename: 'src/test.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 2' }
      ];

      const result = manager.tightenSuppressions(current, diagnostics);

      expect(result).toEqual({
        'src/test.ts': {
          'no-unused-vars': { count: 2 }
        }
      });
    });

    it('should keep count unchanged when violations exceed suppression', () => {
      const current: SuppressionFile = {
        'src/test.ts': {
          'no-unused-vars': { count: 2 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [
        { filename: 'src/test.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 1' },
        { filename: 'src/test.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 2' },
        { filename: 'src/test.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 3' }
      ];

      const result = manager.tightenSuppressions(current, diagnostics);

      expect(result).toEqual({
        'src/test.ts': {
          'no-unused-vars': { count: 2 }
        }
      });
    });

    it('should handle multiple files and rules together', () => {
      const current: SuppressionFile = {
        'src/a.ts': {
          'no-unused-vars': { count: 5 },
          'prefer-const': { count: 3 }
        },
        'src/b.ts': {
          'no-var': { count: 2 },
          'no-console': { count: 1 }
        },
        'src/c.ts': {
          'eqeqeq': { count: 4 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [
        // a.ts: no-unused-vars reduced from 5→2, prefer-const stays at 3
        { filename: 'src/a.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 1' },
        { filename: 'src/a.ts', rule: 'no-unused-vars', severity: 'error', message: 'Unused 2' },
        { filename: 'src/a.ts', rule: 'prefer-const', severity: 'error', message: 'Const 1' },
        { filename: 'src/a.ts', rule: 'prefer-const', severity: 'error', message: 'Const 2' },
        { filename: 'src/a.ts', rule: 'prefer-const', severity: 'error', message: 'Const 3' },
        // b.ts: no-var removed (0 diagnostics), no-console stays at 1
        { filename: 'src/b.ts', rule: 'no-console', severity: 'error', message: 'Console 1' }
        // c.ts: entirely removed (0 diagnostics)
      ];

      const result = manager.tightenSuppressions(current, diagnostics);

      expect(result).toEqual({
        'src/a.ts': {
          'no-unused-vars': { count: 2 },
          'prefer-const': { count: 3 }
        },
        'src/b.ts': {
          'no-console': { count: 1 }
        }
      });
    });

    it('should return empty object when all suppressions are resolved', () => {
      const current: SuppressionFile = {
        'src/test.ts': {
          'no-unused-vars': { count: 2 }
        },
        'src/other.ts': {
          'no-var': { count: 1 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [];

      const result = manager.tightenSuppressions(current, diagnostics);

      expect(result).toEqual({});
    });

    it('should return sorted output', () => {
      const current: SuppressionFile = {
        'src/z.ts': {
          'z-rule': { count: 1 },
          'a-rule': { count: 2 }
        },
        'src/a.ts': {
          'z-rule': { count: 3 },
          'a-rule': { count: 1 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [
        { filename: 'src/z.ts', rule: 'z-rule', severity: 'error', message: 'Z' },
        { filename: 'src/z.ts', rule: 'a-rule', severity: 'error', message: 'A1' },
        { filename: 'src/z.ts', rule: 'a-rule', severity: 'error', message: 'A2' },
        { filename: 'src/a.ts', rule: 'z-rule', severity: 'error', message: 'Z1' },
        { filename: 'src/a.ts', rule: 'z-rule', severity: 'error', message: 'Z2' },
        { filename: 'src/a.ts', rule: 'z-rule', severity: 'error', message: 'Z3' },
        { filename: 'src/a.ts', rule: 'a-rule', severity: 'error', message: 'A' }
      ];

      const result = manager.tightenSuppressions(current, diagnostics);

      const fileKeys = Object.keys(result);
      expect(fileKeys).toEqual(['src/a.ts', 'src/z.ts']);

      const aRules = Object.keys(result['src/a.ts']);
      expect(aRules).toEqual(['a-rule', 'z-rule']);

      const zRules = Object.keys(result['src/z.ts']);
      expect(zRules).toEqual(['a-rule', 'z-rule']);
    });
  });

  describe('updateSuppressions', () => {
    it('should merge new suppressions with existing ones', () => {
      const current = {
        'src/existing.ts': {
          'old-rule': { count: 5 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [
        {
          filename: 'src/new.ts',
          rule: 'new-rule',
          severity: 'error',
          message: 'New error'
        }
      ];

      const updated = manager.updateSuppressions(current, diagnostics);

      expect(updated).toEqual({
        'src/existing.ts': {
          'old-rule': { count: 5 }
        },
        'src/new.ts': {
          'new-rule': { count: 1 }
        }
      });
    });

    it('should update counts for existing files and rules', () => {
      const current = {
        'src/test.ts': {
          'no-unused-vars': { count: 1 }
        }
      };

      const diagnostics: ProcessedDiagnostic[] = [
        {
          filename: 'src/test.ts',
          rule: 'no-unused-vars',
          severity: 'error',
          message: 'Unused 1'
        },
        {
          filename: 'src/test.ts',
          rule: 'no-unused-vars',
          severity: 'error',
          message: 'Unused 2'
        },
        {
          filename: 'src/test.ts',
          rule: 'no-unused-vars',
          severity: 'error',
          message: 'Unused 3'
        }
      ];

      const updated = manager.updateSuppressions(current, diagnostics);

      expect(updated).toEqual({
        'src/test.ts': {
          'no-unused-vars': { count: 3 }
        }
      });
    });
  });
});