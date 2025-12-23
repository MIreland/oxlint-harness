import { Command, Flags, Args } from '@oclif/core';
import { OxlintRunner } from './oxlint-runner.js';
import { SuppressionManager } from './suppression-manager.js';
import { ErrorReporter } from './error-reporter.js';
import { ColorFormatter } from './colors.js';

export default class OxlintHarness extends Command {
  static summary = 'Run oxlint with bulk suppressions support';

  static description = `
Runs oxlint with support for bulk suppressions similar to ESLint.

The suppression file format uses counts per rule per file:
{
  "src/App.tsx": {
    "no-unused-vars": { "count": 1 },
    "prefer-const": { "count": 2 }
  }
}
  `;

  static examples = [
    '<%= config.bin %> <%= command.id %> src/',
    '<%= config.bin %> <%= command.id %> --update src/',
    '<%= config.bin %> <%= command.id %> --suppressions .my-suppressions.json src/',
  ];

  static flags = {
    suppressions: Flags.string({
      char: 's',
      description: 'Path to suppression file',
      default: '.oxlint-suppressions.json',
    }),
    update: Flags.boolean({
      char: 'u',
      description: 'Update/create suppression file with current error counts',
      default: false,
    }),
    'fail-on-excess': Flags.boolean({
      description: 'Exit with non-zero code if there are unsuppressed errors',
      default: true,
      allowNo: true,
    }),
    'show-code': Flags.integer({
      description: 'Show code snippets for files with N or fewer errors (0 to disable)',
      default: 3,
    }),
    help: Flags.help({ char: 'h' }),
  };

  static args = {
    paths: Args.string({
      description: 'Files or directories to lint (passed to oxlint)',
      required: false,
    }),
  };

  static strict = false; // Allow additional args to be passed to oxlint

  async run(): Promise<void> {
    const { flags, argv } = await this.parse(OxlintHarness);
    const colors = new ColorFormatter();

    try {
      // Run oxlint with remaining args
      const runner = new OxlintRunner();
      const diagnostics = await runner.run(argv as string[]);

      // Handle suppression logic
      const suppressionManager = new SuppressionManager(flags.suppressions);

      if (flags.update) {
        // Update mode: generate/update suppression file
        const currentSuppressions = suppressionManager.loadSuppressions();
        const updatedSuppressions = suppressionManager.updateSuppressions(currentSuppressions, diagnostics);
        suppressionManager.saveSuppressions(updatedSuppressions);

        this.log(`${colors.success('Updated suppression file:')} ${colors.filename(flags.suppressions)}`);
        this.log(`${colors.info('Total diagnostics:')} ${colors.emphasis(diagnostics.length.toString())}`);
        return;
      }

      // Normal mode: check suppressions
      const suppressions = suppressionManager.loadSuppressions();
      const excessErrors = suppressionManager.findExcessErrors(diagnostics, suppressions);

      if (excessErrors.length === 0) {
        this.log(`${colors.successIcon()} ${colors.success('All errors are suppressed')}`);
        return;
      }

      // Report excess errors
      const reporter = new ErrorReporter();
      reporter.reportExcessErrors(excessErrors, flags['show-code']);

      if (flags['fail-on-excess']) {
        this.exit(1);
      }

    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}