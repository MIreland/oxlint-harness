import { Command, Flags, Args } from "@oclif/core";
import { OxlintRunner } from "./oxlint-runner.js";
import { SuppressionManager } from "./suppression-manager.js";
import { ErrorReporter } from "./error-reporter.js";
import { ColorFormatter } from "./colors.js";

export default class OxlintHarness extends Command {
  static summary = "Run oxlint with bulk suppressions support";

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
    "<%= config.bin %> <%= command.id %> src/",
    "<%= config.bin %> <%= command.id %> --update src/",
    "<%= config.bin %> <%= command.id %> --suppressions .my-suppressions.json src/",
  ];

  static flags = {
    suppressions: Flags.string({
      char: "s",
      description: "Path to suppression file",
      default: ".oxlint-suppressions.json",
    }),
    update: Flags.boolean({
      char: "u",
      description: "Update/create suppression file with current error counts",
      default: false,
    }),
    "fail-on-excess": Flags.boolean({
      description: "Exit with non-zero code if there are unsuppressed errors",
      default: true,
      allowNo: true,
    }),
    "show-code": Flags.integer({
      description:
        "Show code snippets for files with N or fewer errors (0 to disable)",
      default: 3,
    }),
  };

  static args = {
    paths: Args.string({
      description: "Files or directories to lint (passed to oxlint)",
      required: false,
    }),
  };

  static strict = false; // Allow additional args to be passed to oxlint

  async run(): Promise<void> {
    // Check for help flag first - check both this.argv and process.argv
    const rawArgs = this.argv.slice(1);
    const processArgs = process.argv.slice(2); // Skip 'node' and script path
    const hasHelp =
      rawArgs.includes("--help") ||
      rawArgs.includes("-h") ||
      processArgs.includes("--help") ||
      processArgs.includes("-h");

    if (hasHelp) {
      this.log(OxlintHarness.description);
      this.log("");
      this.log("USAGE");
      this.log(`  $ oxlint-harness [FLAGS] [ARGS]`);
      this.log("");
      this.log("FLAGS");
      this.log(
        "  -s, --suppressions <path>    Path to suppression file (default: .oxlint-suppressions.json)"
      );
      this.log(
        "  -u, --update                  Update/create suppression file with current error counts"
      );
      this.log(
        "      --fail-on-excess          Exit 1 if unsuppressed errors exist (default: true)"
      );
      this.log(
        "      --no-fail-on-excess       Don't exit 1 on unsuppressed errors"
      );
      this.log(
        "      --show-code <number>      Show code snippets for files with N or fewer errors (default: 3, 0 to disable)"
      );
      this.log("  -h, --help                    Show this help message");
      this.log("");
      this.log("ARGS");
      this.log(
        "  <paths>                       Files or directories to lint (passed to oxlint)"
      );
      this.log("");
      this.log("EXAMPLES");
      this.log(`  $ oxlint-harness src/`);
      this.log(`  $ oxlint-harness --update src/`);
      this.log(`  $ oxlint-harness --type-aware src/`);
      this.log(`  $ oxlint-harness --suppressions .my-suppressions.json src/`);
      return;
    }

    // Parse with error handling for unknown flags
    let flags: any;
    let oxlintArgs: string[] = [];

    try {
      const parsed = await this.parse(OxlintHarness);
      flags = parsed.flags;
      oxlintArgs = parsed.argv as string[];
    } catch (error: any) {
      // If error is due to unknown flags (NonExistentFlagsError), manually parse
      if (
        error.name === "NonExistentFlagsError" ||
        (error.flags && Array.isArray(error.flags))
      ) {
        const parsedFlags: any = {
          suppressions: ".oxlint-suppressions.json",
          update: false,
          "fail-on-excess": true,
          "show-code": 3,
        };

        const knownFlagNames = new Set([
          "--suppressions",
          "-s",
          "--update",
          "-u",
          "--fail-on-excess",
          "--no-fail-on-excess",
          "--show-code",
        ]);

        // Manually parse known flags and collect unknown ones
        for (let i = 0; i < rawArgs.length; i++) {
          const arg = rawArgs[i];

          if (arg === "--suppressions" || arg === "-s") {
            parsedFlags.suppressions = rawArgs[++i] || parsedFlags.suppressions;
          } else if (arg === "--update" || arg === "-u") {
            parsedFlags.update = true;
          } else if (arg === "--fail-on-excess") {
            parsedFlags["fail-on-excess"] = true;
          } else if (arg === "--no-fail-on-excess") {
            parsedFlags["fail-on-excess"] = false;
          } else if (arg === "--show-code") {
            const value = rawArgs[++i];
            if (value) parsedFlags["show-code"] = parseInt(value, 10) || 3;
          } else if (
            !knownFlagNames.has(arg) &&
            arg !== "--help" &&
            arg !== "-h"
          ) {
            // Unknown flag or positional arg - pass to oxlint
            oxlintArgs.push(arg);
          }
        }

        flags = parsedFlags;
      } else {
        // Re-throw if it's a different error
        throw error;
      }
    }

    // Check for OXLINT_HARNESS_UPDATE_BULK_SUPPRESSION environment variable
    if (
      process.env.OXLINT_HARNESS_UPDATE_BULK_SUPPRESSION?.toLowerCase() ===
      "true"
    ) {
      flags.update = true;
    }

    const colors = new ColorFormatter();

    try {
      // Run oxlint with remaining args
      const runner = new OxlintRunner();
      const diagnostics = await runner.run(oxlintArgs);

      // Handle suppression logic
      const suppressionManager = new SuppressionManager(flags.suppressions);

      if (flags.update) {
        // Update mode: generate/update suppression file
        const currentSuppressions = suppressionManager.loadSuppressions();
        const updatedSuppressions = suppressionManager.updateSuppressions(
          currentSuppressions,
          diagnostics
        );
        suppressionManager.saveSuppressions(updatedSuppressions);

        this.log(
          `${colors.success("Updated suppression file:")} ${colors.filename(
            flags.suppressions
          )}`
        );
        this.log(
          `${colors.info("Total diagnostics:")} ${colors.emphasis(
            diagnostics.length.toString()
          )}`
        );
        return;
      }

      // Normal mode: check suppressions
      const suppressions = suppressionManager.loadSuppressions();
      const excessErrors = suppressionManager.findExcessErrors(
        diagnostics,
        suppressions
      );

      // Check for OXLINT_HARNESS_TIGHTEN_BULK_SUPPRESSION environment variable
      const shouldTighten =
        process.env.OXLINT_HARNESS_TIGHTEN_BULK_SUPPRESSION?.toLowerCase() ===
        "true";

      if (shouldTighten) {
        // Tighten suppressions by removing/reducing cleaned-up violations
        const tightenedSuppressions = suppressionManager.tightenSuppressions(
          suppressions,
          diagnostics
        );
        suppressionManager.saveSuppressions(tightenedSuppressions);

        this.log(
          `${colors.success("Tightened suppression file:")} ${colors.filename(
            flags.suppressions
          )}`
        );
      }

      if (excessErrors.length === 0) {
        this.log(
          `${colors.successIcon()} ${colors.success(
            "All errors are suppressed"
          )}`
        );
        return;
      }

      // Report excess errors
      const reporter = new ErrorReporter();
      reporter.reportExcessErrors(excessErrors, flags["show-code"]);

      if (flags["fail-on-excess"]) {
        this.exit(1);
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error));
    }
  }
}
