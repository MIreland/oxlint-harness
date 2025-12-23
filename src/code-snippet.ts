import { readFileSync, existsSync } from 'fs';
import { ProcessedDiagnostic } from './types.js';
import { ColorFormatter } from './colors.js';

export interface CodeSnippet {
  beforeLines: string[];
  targetLine: string;
  afterLines: string[];
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
}

export class CodeSnippetExtractor {
  private fileCache = new Map<string, string[]>();
  private colors = new ColorFormatter();

  getCodeSnippet(diagnostic: ProcessedDiagnostic): CodeSnippet | null {
    if (!diagnostic.line || !diagnostic.filename) {
      return null;
    }

    const lines = this.getFileLines(diagnostic.filename);
    if (!lines) {
      return null;
    }

    const lineIndex = diagnostic.line - 1; // Convert to 0-based index
    const contextLines = 2; // Show 2 lines before/after

    const beforeLines = lines.slice(
      Math.max(0, lineIndex - contextLines),
      lineIndex
    );

    const targetLine = lines[lineIndex] || '';

    const afterLines = lines.slice(
      lineIndex + 1,
      Math.min(lines.length, lineIndex + 1 + contextLines)
    );

    return {
      beforeLines,
      targetLine,
      afterLines,
      lineNumber: diagnostic.line,
      columnStart: diagnostic.column || 0,
      columnEnd: (diagnostic.column || 0) + (diagnostic.message.length || 10), // Rough estimate
    };
  }

  private getFileLines(filename: string): string[] | null {
    if (this.fileCache.has(filename)) {
      return this.fileCache.get(filename)!;
    }

    if (!existsSync(filename)) {
      return null;
    }

    try {
      const content = readFileSync(filename, 'utf8');
      const lines = content.split('\n');
      this.fileCache.set(filename, lines);
      return lines;
    } catch (error) {
      return null;
    }
  }

  formatCodeSnippet(snippet: CodeSnippet, rule: string, message: string, help?: string): string {
    let output = '';

    // Error header with colors
    output += `  ${this.colors.errorIcon()} ${this.colors.rule(rule)}: ${message}\n`;

    const startLineNum = snippet.lineNumber - snippet.beforeLines.length;
    const endLineNum = snippet.lineNumber + snippet.afterLines.length;

    // File path and line range with colors
    output += `     ${this.colors.border('╭─')}${this.colors.filename(`[${startLineNum}:${snippet.columnStart}]`)}\n`;

    // Before lines
    snippet.beforeLines.forEach((line, index) => {
      const lineNum = startLineNum + index;
      const lineNumStr = this.colors.lineNumber(lineNum.toString().padStart(4));
      const border = this.colors.border(' │ ');
      output += `${lineNumStr}${border}${this.highlightSyntax(line)}\n`;
    });

    // Target line with error highlight
    const targetLineNumStr = this.colors.lineNumber(snippet.lineNumber.toString().padStart(4));
    const targetBorder = this.colors.border(' │ ');
    output += `${targetLineNumStr}${targetBorder}${this.highlightSyntax(snippet.targetLine)}\n`;

    // Error pointer with color
    const indent = ' '.repeat(4 + 3 + snippet.columnStart); // Line number + "│ " + column offset
    const pointer = this.colors.errorPointer('─'.repeat(Math.max(1, Math.min(snippet.columnEnd - snippet.columnStart, 20))));
    output += `${indent}${pointer}\n`;

    // After lines
    snippet.afterLines.forEach((line, index) => {
      const lineNum = snippet.lineNumber + 1 + index;
      const lineNumStr = this.colors.lineNumber(lineNum.toString().padStart(4));
      const border = this.colors.border(' │ ');
      output += `${lineNumStr}${border}${this.highlightSyntax(line)}\n`;
    });

    output += `     ${this.colors.border('╰────')}\n`;

    // Help text with color
    if (help) {
      output += `  ${this.colors.help('help:')} ${help}\n`;
    }

    return output;
  }

  private highlightSyntax(line: string): string {
    // Simple syntax highlighting for common patterns
    return line
      // Keywords
      .replace(/\b(const|let|var|function|class|if|else|for|while|return|import|export|from|await|async)\b/g,
               match => this.colors.keyword(match))
      // Strings
      .replace(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g,
               match => this.colors.string(match))
      // Comments
      .replace(/(\/\/.*$|\/\*.*?\*\/)/g,
               match => this.colors.comment(match))
      // Numbers
      .replace(/\b\d+\b/g,
               match => this.colors.info(match));
  }
}