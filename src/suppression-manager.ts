import { readFileSync, writeFileSync, existsSync } from "fs";
import {
  SuppressionFile,
  SuppressionRule,
  ProcessedDiagnostic,
  ExcessError,
} from "./types.js";

export class SuppressionManager {
  private suppressionFile: string;

  constructor(suppressionFile: string = ".oxlint-suppressions.json") {
    this.suppressionFile = suppressionFile;
  }

  private sortSuppressions(suppressions: SuppressionFile): SuppressionFile {
    const sorted: SuppressionFile = {};
    const sortedFilenames = Object.keys(suppressions).sort();

    for (const filename of sortedFilenames) {
      const rules = suppressions[filename];
      const sortedRules: { [ruleName: string]: SuppressionRule } = {};
      const sortedRuleNames = Object.keys(rules).sort();

      for (const ruleName of sortedRuleNames) {
        sortedRules[ruleName] = rules[ruleName];
      }

      sorted[filename] = sortedRules;
    }

    return sorted;
  }

  loadSuppressions(): SuppressionFile {
    if (!existsSync(this.suppressionFile)) {
      return {};
    }

    try {
      const content = readFileSync(this.suppressionFile, "utf8");
      return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to parse suppression file ${this.suppressionFile}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  saveSuppressions(suppressions: SuppressionFile): void {
    try {
      const sorted = this.sortSuppressions(suppressions);
      const content = JSON.stringify(sorted, null, 2);
      writeFileSync(this.suppressionFile, content, "utf8");
    } catch (error) {
      throw new Error(
        `Failed to write suppression file ${this.suppressionFile}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  generateSuppressions(diagnostics: ProcessedDiagnostic[]): SuppressionFile {
    const suppressions: SuppressionFile = {};

    // Group diagnostics by file and rule
    const counts = new Map<string, Map<string, number>>();

    for (const diagnostic of diagnostics) {
      if (!counts.has(diagnostic.filename)) {
        counts.set(diagnostic.filename, new Map());
      }

      const fileRules = counts.get(diagnostic.filename)!;
      const currentCount = fileRules.get(diagnostic.rule) || 0;
      fileRules.set(diagnostic.rule, currentCount + 1);
    }

    // Convert to suppression format
    for (const [filename, rules] of counts.entries()) {
      suppressions[filename] = {};
      for (const [rule, count] of rules.entries()) {
        suppressions[filename][rule] = { count };
      }
    }

    return this.sortSuppressions(suppressions);
  }

  findExcessErrors(
    diagnostics: ProcessedDiagnostic[],
    suppressions: SuppressionFile
  ): ExcessError[] {
    const excessErrors: ExcessError[] = [];

    // Group diagnostics by file and rule
    const actualCounts = new Map<string, Map<string, ProcessedDiagnostic[]>>();

    for (const diagnostic of diagnostics) {
      if (!actualCounts.has(diagnostic.filename)) {
        actualCounts.set(diagnostic.filename, new Map());
      }

      const fileRules = actualCounts.get(diagnostic.filename)!;
      if (!fileRules.has(diagnostic.rule)) {
        fileRules.set(diagnostic.rule, []);
      }
      fileRules.get(diagnostic.rule)!.push(diagnostic);
    }

    // Compare actual vs suppressed counts
    for (const [filename, rules] of actualCounts.entries()) {
      for (const [rule, diagnosticsForRule] of rules.entries()) {
        const actual = diagnosticsForRule.length;
        const expected = suppressions[filename]?.[rule]?.count || 0;

        if (actual > expected) {
          excessErrors.push({
            rule,
            filename,
            expected,
            actual,
            diagnostics: diagnosticsForRule,
          });
        }
      }
    }

    return excessErrors;
  }

  updateSuppressions(
    currentSuppressions: SuppressionFile,
    diagnostics: ProcessedDiagnostic[]
  ): SuppressionFile {
    const newSuppressions = this.generateSuppressions(diagnostics);

    // Merge with existing suppressions, using new counts
    const updated: SuppressionFile = { ...currentSuppressions };

    for (const [filename, rules] of Object.entries(newSuppressions)) {
      updated[filename] = { ...updated[filename], ...rules };
    }

    // Remove files with no rules
    for (const [filename, rules] of Object.entries(updated)) {
      if (Object.keys(rules).length === 0) {
        delete updated[filename];
      }
    }

    return this.sortSuppressions(updated);
  }

  tightenSuppressions(
    currentSuppressions: SuppressionFile,
    diagnostics: ProcessedDiagnostic[]
  ): SuppressionFile {
    // Group diagnostics by file and rule to get actual counts
    const actualCounts = new Map<string, Map<string, number>>();

    for (const diagnostic of diagnostics) {
      if (!actualCounts.has(diagnostic.filename)) {
        actualCounts.set(diagnostic.filename, new Map());
      }

      const fileRules = actualCounts.get(diagnostic.filename)!;
      const currentCount = fileRules.get(diagnostic.rule) || 0;
      fileRules.set(diagnostic.rule, currentCount + 1);
    }

    // Create a copy of current suppressions to modify
    const tightened: SuppressionFile = { ...currentSuppressions };

    // Process each file in current suppressions
    for (const [filename, rules] of Object.entries(tightened)) {
      const fileRules = { ...rules };

      // Process each rule in the file
      for (const [rule, suppression] of Object.entries(fileRules)) {
        const expected = suppression.count;
        const actual = actualCounts.get(filename)?.get(rule) || 0;

        if (actual === 0) {
          // Remove entry if no actual errors exist
          delete fileRules[rule];
        } else if (actual < expected) {
          // Reduce count to actual if violations were cleaned up
          fileRules[rule] = { count: actual };
        }
        // If actual >= expected, keep as is (excess errors handled by findExcessErrors)
      }

      // Update the file entry
      if (Object.keys(fileRules).length === 0) {
        // Remove file entry if no rules remain
        delete tightened[filename];
      } else {
        tightened[filename] = fileRules;
      }
    }

    return this.sortSuppressions(tightened);
  }
}
