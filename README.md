# oxlint-harness

A harness for [oxlint](https://oxc.rs) that provides ESLint-style bulk suppressions support. This tool allows you to gradually adopt stricter linting rules by suppressing existing violations while preventing new ones.

## Features

- ✅ **Bulk Suppressions**: Suppress specific counts of lint violations per file per rule
- ✅ **Incremental Adoption**: Only fail on new violations beyond suppressed counts
- ✅ **Rich Colored Output**: Beautiful terminal colors with syntax highlighting
- ✅ **Code Snippets**: Show actual code context for files with few errors (configurable)
- ✅ **Smart Package Detection**: Auto-detects pnpm/yarn/npm with monorepo support
- ✅ **Update Mode**: Generate/update suppression files automatically
- ✅ **Pass-through**: Forward all arguments to oxlint seamlessly

## Installation

```bash
npm install oxlint-harness
# or
pnpm add oxlint-harness
# or
yarn add oxlint-harness
```

## Quick Start

```bash
# Run oxlint with suppressions (fails on excess errors)
npx oxlint-harness src/

# Generate initial suppression file
npx oxlint-harness --update src/

# Use custom suppression file
npx oxlint-harness --suppressions .my-suppressions.json src/
```

## Suppression File Format

The suppression file uses a count-based format:

```json
{
  "src/App.tsx": {
    "@typescript-eslint/no-unused-vars": { "count": 1 },
    "eqeqeq": { "count": 1 },
    "no-var": { "count": 1 },
    "prefer-const": { "count": 1 }
  },
  "src/utils.ts": {
    "no-console": { "count": 3 }
  }
}
```

## CLI Options

| Option                | Short | Description                                                        | Default                     |
| --------------------- | ----- | ------------------------------------------------------------------ | --------------------------- |
| `--suppressions`      | `-s`  | Path to suppression file                                           | `.oxlint-suppressions.json` |
| `--update`            | `-u`  | Update/create suppression file                                     | `false`                     |
| `--show-code`         |       | Show code snippets for files with N or fewer errors (0 to disable) | `3`                         |
| `--fail-on-excess`    |       | Exit 1 if unsuppressed errors exist                                | `true`                      |
| `--no-fail-on-excess` |       | Don't exit 1 on unsuppressed errors                                | -                           |
| `--help`              | `-h`  | Show help                                                          | -                           |

### Environment Variables

| Variable                                  | Description                                                                                                | Equivalent Flag |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------- |
| `OXLINT_HARNESS_UPDATE_BULK_SUPPRESSION`  | Set to `true` to update/create suppression file                                                            | `--update`      |
| `OXLINT_HARNESS_TIGHTEN_BULK_SUPPRESSION` | Set to `true` to automatically remove/reduce suppressions for cleaned-up violations during non-update runs | -               |

Example:

```bash
OXLINT_HARNESS_UPDATE_BULK_SUPPRESSION=true npx oxlint-harness src/
OXLINT_HARNESS_TIGHTEN_BULK_SUPPRESSION=true npx oxlint-harness src/
```

### Passing Additional oxlint Flags

All additional arguments and unknown flags are passed directly to oxlint. This allows you to use any oxlint-specific options, even if they are not documented here.

For example, to enable type-aware linting:

```bash
npx oxlint-harness --type-aware src/
```

Any flag not recognized by oxlint-harness will be forwarded to oxlint automatically.

## Usage Examples

### Basic Usage

```bash
# Check files with suppressions
npx oxlint-harness src/ lib/

# Pass oxlint options
npx oxlint-harness --type-aware src/

# Use different suppression file
npx oxlint-harness -s .eslint-suppressions.json src/

# Show code snippets for files with ≤1 error
npx oxlint-harness --show-code 1 src/

# Disable code snippets (simple list only)
npx oxlint-harness --show-code 0 src/
```

### Generating Suppressions

```bash
# Create initial suppression file (records current error counts)
npx oxlint-harness --update src/

# Update existing suppressions with new counts
npx oxlint-harness --update --suppressions custom.json src/
```

### CI Integration

```bash
# In CI: fail build if new errors are introduced
npx oxlint-harness src/

# For reporting mode (don't fail build)
npx oxlint-harness --no-fail-on-excess src/
```

## Workflow

### Initial Setup

1. Run with `--update` to create initial suppression file:

   ```bash
   npx oxlint-harness --update src/
   ```

2. Commit the `.oxlint-suppressions.json` file

3. Configure CI to run `npx oxlint-harness src/`

### Daily Development

- **Normal runs**: Only new violations (beyond suppressed counts) will cause failures
- **Fixing violations**: Counts automatically decrease as issues are resolved
- **Adding suppressions**: Update counts manually or re-run with `--update`

### Example Output

#### With Code Snippets (default for files with ≤3 errors)

```
❌ Found unsuppressed errors:

📄 src/App.tsx:
  ⚠️  eslint(no-unused-vars): 1 excess error (expected: 0, actual: 1)

  × eslint(no-unused-vars): Variable 'thing' is declared but never used. Unused variables should start with a '_'.
     ╭─[24:7]
  24 │ }));
  25 │
  26 │ const thing = 3;
              ─────────────
  27 │
  28 │ const PartnerAppRootBase: React.VFC = () => {
     ╰────
  help: Consider removing this declaration.

    📝 To suppress, re-run with:
    OXLINT_HARNESS_UPDATE_BULK_SUPPRESSION=true oxlint-harness [your-args]

📊 Summary:
   • Files with issues: 1
   • Rules with excess errors: 1
   • Total excess errors: 1

💡 To suppress all current errors, run:
   oxlint-harness --update src/
```

#### With Many Errors (first error shown with code snippet)

```
📄 src/Components.tsx:
  ⚠️  prefer-const: 15 excess errors (expected: 10, actual: 25)

  × prefer-const: 'data' is never reassigned. Use 'const' instead.
     ╭─[42:12]
  42 │ let data = fetchData();
              ─────────────
  help: Use 'const' instead.

    • src/Components.tsx:58:8: 'config' is never reassigned
    • src/Components.tsx:74:15: 'result' is never reassigned
    ... and 12 more

    📝 To suppress, re-run with:
    OXLINT_HARNESS_UPDATE_BULK_SUPPRESSION=true oxlint-harness [your-args]
```

## Requirements

- Node.js 22+ (for native TypeScript support)
- `oxlint` installed and available (via pnpm/yarn/npm)

## How It Works

1. **Package Manager Detection**: Automatically detects if you're using pnpm, yarn, or npm by looking for lock files up the directory tree (supports monorepos)
2. **Oxlint Execution**: Runs `pnpm oxlint`, `yarn oxlint`, or `npx oxlint` with JSON output
3. **Suppression Matching**: Compares actual error counts against your suppression file
4. **Smart Reporting**: Shows code snippets for files with few errors, simple lists for files with many errors
5. **Colored Output**: Beautiful terminal colors that automatically disable in non-TTY environments

## Contributing

Issues and pull requests are welcome! Please see the [GitHub repository](https://github.com/MIreland/oxlint-harness) for more information.

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Lint
pnpm lint

# Development mode
pnpm dev --help
```

## License

MIT
