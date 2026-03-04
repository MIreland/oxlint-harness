import { Command, Flags, Args } from "@oclif/core";
import { mkdir, writeFile } from "fs/promises";
import { dirname } from "path";
import { OxlintRunner } from "./oxlint-runner.js";
import { SuppressionManager } from "./suppression-manager.js";
import { ErrorReporter } from "./error-reporter.js";
import { ColorFormatter } from "./colors.js";
import { ProcessedDiagnostic } from "./types.js";

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
    "results-path": Flags.string({
      description:
        "Path to save oxlint JSON results (default: artifacts/oxlint-results.json)",
      default: "artifacts/oxlint-results.json",
      env: "OXLINT_HARNESS_RESULTS_PATH",
    }),
    "save-results": Flags.boolean({
      description: "Save oxlint JSON results to file",
      default: true,
      allowNo: true,
    }),
    tighten: Flags.boolean({
      char: "t",
      description:
        "Tighten suppressions by reducing counts when violations are fixed",
      default: true,
      allowNo: true,
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
    const rawArgs = this.argv;
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
      this.log(
        "      --results-path <path>     Path to save oxlint JSON results (default: artifacts/oxlint-results.json)"
      );
      this.log(
        "      --no-save-results         Don't save oxlint JSON results to file"
      );
      this.log(
        "  -t, --tighten                 Tighten suppressions when violations are fixed (default: true)"
      );
      this.log(
        "      --no-tighten              Don't tighten suppressions"
      );
      this.log(
        "      --no-type-aware           Don't pass --type-aware to oxlint (default: passes it)"
      );
      this.log(
        "      --no-type-check           Don't pass --type-check to oxlint (default: passes it)"
      );
      this.log("  -h, --help                    Show this help message");
      this.log("");
      this.log("ENVIRONMENT VARIABLES");
      this.log(
        "  OXLINT_HARNESS_RESULTS_PATH          Override the results file path"
      );
      this.log(
        "  OXLINT_HARNESS_NO_FAIL_ON_EXCESS     Set to 'true' to exit 0 on new errors"
      );
      this.log(
        "  OXLINT_HARNESS_NO_TYPE_AWARE         Set to 'true' to skip --type-aware"
      );
      this.log(
        "  OXLINT_HARNESS_NO_TYPE_CHECK         Set to 'true' to skip --type-check"
      );
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

    const knownFlagNames = new Set([
      "--suppressions",
      "-s",
      "--update",
      "-u",
      "--fail-on-excess",
      "--no-fail-on-excess",
      "--show-code",
      "--results-path",
      "--save-results",
      "--no-save-results",
      "--tighten",
      "-t",
      "--no-tighten",
      "--no-type-aware",
      "--no-type-check",
    ]);

    const collectOxlintArgs = (args: string[]): string[] => {
      const passthrough: string[] = [];

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === "--suppressions" || arg === "-s") {
          i++; // consume value
          continue;
        }
        if (arg === "--update" || arg === "-u") {
          continue;
        }
        if (arg === "--fail-on-excess" || arg === "--no-fail-on-excess") {
          continue;
        }
        if (arg === "--show-code") {
          i++; // consume value
          continue;
        }
        if (arg === "--results-path") {
          i++; // consume value
          continue;
        }
        if (arg === "--save-results" || arg === "--no-save-results") {
          continue;
        }
        if (arg === "--tighten" || arg === "-t" || arg === "--no-tighten") {
          continue;
        }
        if (arg === "--no-type-aware" || arg === "--no-type-check") {
          continue;
        }
        if (arg === "--help" || arg === "-h") {
          continue;
        }

        // Unknown flag or positional arg - pass to oxlint
        passthrough.push(arg);
      }

      return passthrough;
    };

    try {
      const parsed = await this.parse(OxlintHarness);
      flags = parsed.flags;
      oxlintArgs = collectOxlintArgs(rawArgs);
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
          "results-path":
            process.env.OXLINT_HARNESS_RESULTS_PATH ||
            "artifacts/oxlint-results.json",
          "save-results": true,
          tighten: true,
        };

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
          } else if (arg === "--results-path") {
            parsedFlags["results-path"] =
              rawArgs[++i] || parsedFlags["results-path"];
          } else if (arg === "--save-results") {
            parsedFlags["save-results"] = true;
          } else if (arg === "--no-save-results") {
            parsedFlags["save-results"] = false;
          } else if (arg === "--tighten" || arg === "-t") {
            parsedFlags.tighten = true;
          } else if (arg === "--no-tighten") {
            parsedFlags.tighten = false;
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

    // Default --type-aware and --type-check unless opted out
    const noTypeAware =
      rawArgs.includes("--no-type-aware") ||
      process.env.OXLINT_HARNESS_NO_TYPE_AWARE?.toLowerCase() === "true";
    const noTypeCheck =
      rawArgs.includes("--no-type-check") ||
      process.env.OXLINT_HARNESS_NO_TYPE_CHECK?.toLowerCase() === "true";

    if (!noTypeAware && !oxlintArgs.includes("--type-aware")) {
      oxlintArgs.unshift("--type-aware");
    }
    if (!noTypeCheck && !oxlintArgs.includes("--type-check")) {
      oxlintArgs.unshift("--type-check");
    }

    // Check for OXLINT_HARNESS_UPDATE_BULK_SUPPRESSION environment variable
    if (
      process.env.OXLINT_HARNESS_UPDATE_BULK_SUPPRESSION?.toLowerCase() ===
      "true"
    ) {
      flags.update = true;
    }

    // Check for OXLINT_HARNESS_NO_FAIL_ON_EXCESS environment variable
    if (
      process.env.OXLINT_HARNESS_NO_FAIL_ON_EXCESS?.toLowerCase() === "true"
    ) {
      flags["fail-on-excess"] = false;
    }

    const colors = new ColorFormatter();

    try {
      // Run oxlint with remaining args
      const runner = new OxlintRunner();
      const diagnostics = await runner.run(oxlintArgs);

      // Save results if enabled
      if (flags["save-results"]) {
        await this.saveResults(flags["results-path"], diagnostics);
      }

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

      // Tighten is on by default; env var can override the flag
      let shouldTighten = flags.tighten;
      if (
        process.env.OXLINT_HARNESS_TIGHTEN_BULK_SUPPRESSION?.toLowerCase() ===
        "true"
      ) {
        shouldTighten = true;
      }

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
        process.exit(1);
      }
    } catch (error) {
      this.logToStderr(error instanceof Error ? error.message : String(error));
      process.exit(2);
    }
  }

  private async saveResults(
    path: string,
    diagnostics: ProcessedDiagnostic[]
  ): Promise<void> {
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    await writeFile(path, JSON.stringify(diagnostics, null, 2));
  }
}
