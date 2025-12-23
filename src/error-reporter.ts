import { ExcessError } from './types.js';
import { CodeSnippetExtractor } from './code-snippet.js';
import { ColorFormatter } from './colors.js';

export class ErrorReporter {
  private snippetExtractor = new CodeSnippetExtractor();
  private colors = new ColorFormatter();

  reportExcessErrors(excessErrors: ExcessError[], showCodeThreshold: number = 3): void {
    console.error(`${this.colors.error('❌')} Found unsuppressed errors:\n`);

    let totalExcess = 0;

    // Group errors by file for better readability
    const errorsByFile = new Map<string, ExcessError[]>();
    for (const error of excessErrors) {
      if (!errorsByFile.has(error.filename)) {
        errorsByFile.set(error.filename, []);
      }
      errorsByFile.get(error.filename)!.push(error);
    }

    for (const [filename, fileErrors] of errorsByFile.entries()) {
      console.error(`📄 ${this.colors.filename(filename)}:`);

      for (const error of fileErrors) {
        const excess = error.actual - error.expected;
        totalExcess += excess;

        const excessText = excess === 1 ? 'error' : 'errors';
        console.error(`  ${this.colors.warningIcon()}  ${this.colors.rule(error.rule)}: ${this.colors.emphasis(excess.toString())} excess ${excessText} (expected: ${this.colors.muted(error.expected.toString())}, actual: ${this.colors.emphasis(error.actual.toString())})`);

        // Show detailed code snippets for files with few errors
        if (showCodeThreshold > 0 && error.diagnostics.length <= showCodeThreshold) {
          console.error(''); // Add spacing before code snippets

          error.diagnostics.forEach((diagnostic, index) => {
            const snippet = this.snippetExtractor.getCodeSnippet(diagnostic);
            if (snippet) {
              const formattedSnippet = this.snippetExtractor.formatCodeSnippet(
                snippet,
                diagnostic.rule,
                diagnostic.message,
                diagnostic.help
              );
              console.error(formattedSnippet);
            } else {
              // Fallback to simple format if can't read file
              const location = diagnostic.line ? `:${this.colors.lineNumber(diagnostic.line.toString())}:${this.colors.lineNumber((diagnostic.column || 0).toString())}` : '';
              console.error(`    • ${this.colors.filename(diagnostic.filename)}${location}: ${diagnostic.message}`);
              if (diagnostic.help) {
                console.error(`      ${this.colors.infoIcon()} ${this.colors.help(diagnostic.help)}`);
              }
            }
          });
        } else {
          // Show up to 3 example diagnostics for files with many errors
          const exampleCount = Math.min(3, error.diagnostics.length);
          for (let i = 0; i < exampleCount; i++) {
            const diagnostic = error.diagnostics[i];
            const location = diagnostic.line ? `:${this.colors.lineNumber(diagnostic.line.toString())}:${this.colors.lineNumber((diagnostic.column || 0).toString())}` : '';
            console.error(`    • ${this.colors.filename(diagnostic.filename)}${location}: ${diagnostic.message}`);

            if (diagnostic.help) {
              console.error(`      ${this.colors.infoIcon()} ${this.colors.help(diagnostic.help)}`);
            }
          }

          if (error.diagnostics.length > exampleCount) {
            console.error(`    ${this.colors.muted(`... and ${error.diagnostics.length - exampleCount} more`)}`);
          }
        }

        // Suggestion to suppress
        console.error(`    📝 ${this.colors.info('To suppress, add to suppression file:')}`);
        console.error(`       ${this.colors.muted('"')}${this.colors.filename(error.filename)}${this.colors.muted('"')}: { ${this.colors.muted('"')}${this.colors.rule(error.rule)}${this.colors.muted('"')}: { ${this.colors.muted('"count"')}: ${this.colors.emphasis(error.actual.toString())} } }\n`);
      }
    }

    console.error(`\n📊 ${this.colors.info('Summary:')}`);
    console.error(`   • Files with issues: ${this.colors.emphasis(errorsByFile.size.toString())}`);
    console.error(`   • Rules with excess errors: ${this.colors.emphasis(excessErrors.length.toString())}`);
    console.error(`   • Total excess errors: ${this.colors.emphasis(totalExcess.toString())}`);

    console.error(`\n${this.colors.infoIcon()} ${this.colors.info('To suppress all current errors, run:')}`);
    console.error(`   ${this.colors.emphasis('oxlint-harness --update [your-args]')}`);
  }
}