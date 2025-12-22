import { ExcessError } from './types.js';

export class ErrorReporter {
  reportExcessErrors(excessErrors: ExcessError[]): void {
    console.error('❌ Found unsuppressed errors:\n');

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
      console.error(`📄 ${filename}:`);

      for (const error of fileErrors) {
        const excess = error.actual - error.expected;
        totalExcess += excess;

        console.error(`  ⚠️  ${error.rule}: ${excess} excess error${excess > 1 ? 's' : ''} (expected: ${error.expected}, actual: ${error.actual})`);

        // Show up to 3 example diagnostics for context
        const exampleCount = Math.min(3, error.diagnostics.length);
        for (let i = 0; i < exampleCount; i++) {
          const diagnostic = error.diagnostics[i];
          const location = diagnostic.line ? `:${diagnostic.line}` : '';
          console.error(`    • ${diagnostic.filename}${location}: ${diagnostic.message}`);

          if (diagnostic.help) {
            console.error(`      💡 ${diagnostic.help}`);
          }
        }

        if (error.diagnostics.length > exampleCount) {
          console.error(`    ... and ${error.diagnostics.length - exampleCount} more`);
        }

        // Suggestion to suppress
        console.error(`    📝 To suppress, add to suppression file:`);
        console.error(`       "${error.filename}": { "${error.rule}": { "count": ${error.actual} } }\n`);
      }
    }

    console.error(`\n📊 Summary:`);
    console.error(`   • Files with issues: ${errorsByFile.size}`);
    console.error(`   • Rules with excess errors: ${excessErrors.length}`);
    console.error(`   • Total excess errors: ${totalExcess}`);

    console.error(`\n💡 To suppress all current errors, run:`);
    console.error(`   oxlint-harness --update [your-args]`);
  }
}