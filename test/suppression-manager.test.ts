import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlinkSync, existsSync } from 'fs';
import { SuppressionManager } from '../src/suppression-manager.js';
import { ProcessedDiagnostic } from '../src/types.js';

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