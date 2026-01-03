import { ExcessError } from "./types.js";
import { CodeSnippetExtractor } from "./code-snippet.js";
import { ColorFormatter } from "./colors.js";

export class ErrorReporter {
  private snippetExtractor = new CodeSnippetExtractor();
  private colors = new ColorFormatter();

  reportExcessErrors(
    excessErrors: ExcessError[],
    showCodeThreshold: number = 3
  ): void {
    console.error(`${this.colors.error("❌")} Found unsuppressed errors:\n`);

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

        const excessText = excess === 1 ? "error" : "errors";
        console.error(
          `  ${this.colors.warningIcon()}  ${this.colors.rule(
            error.rule
          )}: ${this.colors.emphasis(
            excess.toString()
          )} excess ${excessText} (expected: ${this.colors.muted(
            error.expected.toString()
          )}, actual: ${this.colors.emphasis(error.actual.toString())})`
        );

        // Always show the first diagnostic with full code snippet
        if (showCodeThreshold > 0 && error.diagnostics.length > 0) {
          console.error(""); // Add spacing before code snippets

          // Always show first diagnostic with code snippet
          const firstDiagnostic = error.diagnostics[0];
          const snippet = this.snippetExtractor.getCodeSnippet(firstDiagnostic);
          if (snippet) {
            const formattedSnippet = this.snippetExtractor.formatCodeSnippet(
              snippet,
              firstDiagnostic.rule,
              firstDiagnostic.message,
              firstDiagnostic.help
            );
            console.error(formattedSnippet);
          } else {
            // Fallback to simple format if can't read file
            const location = firstDiagnostic.line
              ? `:${this.colors.lineNumber(
                  firstDiagnostic.line.toString()
                )}:${this.colors.lineNumber(
                  (firstDiagnostic.column || 0).toString()
                )}`
              : "";
            console.error(
              `    • ${this.colors.filename(
                firstDiagnostic.filename
              )}${location}: ${firstDiagnostic.message}`
            );
            if (firstDiagnostic.help) {
              console.error(
                `      ${this.colors.infoIcon()} ${this.colors.help(
                  firstDiagnostic.help
                )}`
              );
            }
          }

          // If there are more diagnostics, show them based on threshold
          if (error.diagnostics.length > 1) {
            if (error.diagnostics.length <= showCodeThreshold) {
              // Show remaining diagnostics with snippets if under threshold
              for (let i = 1; i < error.diagnostics.length; i++) {
                const diagnostic = error.diagnostics[i];
                const snippet =
                  this.snippetExtractor.getCodeSnippet(diagnostic);
                if (snippet) {
                  const formattedSnippet =
                    this.snippetExtractor.formatCodeSnippet(
                      snippet,
                      diagnostic.rule,
                      diagnostic.message,
                      diagnostic.help
                    );
                  console.error(formattedSnippet);
                } else {
                  // Fallback to simple format if can't read file
                  const location = diagnostic.line
                    ? `:${this.colors.lineNumber(
                        diagnostic.line.toString()
                      )}:${this.colors.lineNumber(
                        (diagnostic.column || 0).toString()
                      )}`
                    : "";
                  console.error(
                    `    • ${this.colors.filename(
                      diagnostic.filename
                    )}${location}: ${diagnostic.message}`
                  );
                  if (diagnostic.help) {
                    console.error(
                      `      ${this.colors.infoIcon()} ${this.colors.help(
                        diagnostic.help
                      )}`
                    );
                  }
                }
              }
            } else {
              // Show remaining diagnostics (up to 2 more) as simple list items
              const remainingCount = Math.min(2, error.diagnostics.length - 1);
              for (let i = 1; i <= remainingCount; i++) {
                const diagnostic = error.diagnostics[i];
                const location = diagnostic.line
                  ? `:${this.colors.lineNumber(
                      diagnostic.line.toString()
                    )}:${this.colors.lineNumber(
                      (diagnostic.column || 0).toString()
                    )}`
                  : "";
                console.error(
                  `    • ${this.colors.filename(
                    diagnostic.filename
                  )}${location}: ${diagnostic.message}`
                );

                if (diagnostic.help) {
                  console.error(
                    `      ${this.colors.infoIcon()} ${this.colors.help(
                      diagnostic.help
                    )}`
                  );
                }
              }

              if (error.diagnostics.length > remainingCount + 1) {
                console.error(
                  `    ${this.colors.muted(
                    `... and ${
                      error.diagnostics.length - remainingCount - 1
                    } more`
                  )}`
                );
              }
            }
          }
        }

        // Suggestion to suppress
        console.error(
          `    📝 ${this.colors.info("To suppress, re-run with:")}`
        );
        console.error(
          `    ${this.colors.emphasis(
            "OXLINT_HARNESS_UPDATE_BULK_SUPPRESSION=true oxlint-harness [your-args]"
          )}\n`
        );
      }
    }

    console.error(`\n📊 ${this.colors.info("Summary:")}`);
    console.error(
      `   • Files with issues: ${this.colors.emphasis(
        errorsByFile.size.toString()
      )}`
    );
    console.error(
      `   • Rules with excess errors: ${this.colors.emphasis(
        excessErrors.length.toString()
      )}`
    );
    console.error(
      `   • Total excess errors: ${this.colors.emphasis(
        totalExcess.toString()
      )}`
    );

    console.error(
      `\n${this.colors.infoIcon()} ${this.colors.info(
        "To suppress all current errors, run:"
      )}`
    );
    console.error(
      `   ${this.colors.emphasis("oxlint-harness --update [your-args]")}`
    );
  }
}
