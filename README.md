# oxlint-harness

A harness for [oxlint](https://oxc.rs) that provides ESLint-style bulk suppressions support. This tool allows you to gradually adopt stricter linting rules by suppressing existing violations while preventing new ones.

## Features

- ✅ **Bulk Suppressions**: Suppress specific counts of lint violations per file per rule
- ✅ **Incremental Adoption**: Only fail on new violations beyond suppressed counts
- ✅ **Detailed Reporting**: Rich error output with context and suggestions
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

| Option | Short | Description | Default |
|--------|--------|-------------|---------|
| `--suppressions` | `-s` | Path to suppression file | `.oxlint-suppressions.json` |
| `--update` | `-u` | Update/create suppression file | `false` |
| `--fail-on-excess` |  | Exit 1 if unsuppressed errors exist | `true` |
| `--no-fail-on-excess` |  | Don't exit 1 on unsuppressed errors | - |
| `--help` | `-h` | Show help | - |

All additional arguments are passed directly to oxlint.

## Usage Examples

### Basic Usage

```bash
# Check files with suppressions
npx oxlint-harness src/ lib/

# Pass oxlint options
npx oxlint-harness --type-aware src/

# Use different suppression file
npx oxlint-harness -s .eslint-suppressions.json src/
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

```
❌ Found unsuppressed errors:

📄 src/App.tsx:
  ⚠️  no-unused-vars: 2 excess errors (expected: 1, actual: 3)
    • src/App.tsx:15: 'unused' is assigned a value but never used
    • src/App.tsx:23: 'data' is assigned a value but never used
    • src/App.tsx:31: 'config' is assigned a value but never used
    💡 To suppress, add to suppression file:
       "src/App.tsx": { "no-unused-vars": { "count": 3 } }

📊 Summary:
   • Files with issues: 1
   • Rules with excess errors: 1
   • Total excess errors: 2

💡 To suppress all current errors, run:
   oxlint-harness --update src/
```

## Requirements

- Node.js 22+ (for native TypeScript support)
- `oxlint` installed and available in PATH

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