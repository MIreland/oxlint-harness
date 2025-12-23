// ANSI color codes for terminal output
export const colors = {
  // Basic colors
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',

  // Bright foreground colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

export class ColorFormatter {
  private useColors: boolean;

  constructor(useColors: boolean = true) {
    this.useColors = useColors && process.stdout.isTTY;
  }

  private colorize(text: string, color: string): string {
    if (!this.useColors) return text;
    return `${color}${text}${colors.reset}`;
  }

  // Error levels
  error(text: string): string {
    return this.colorize(text, colors.brightRed);
  }

  warning(text: string): string {
    return this.colorize(text, colors.brightYellow);
  }

  success(text: string): string {
    return this.colorize(text, colors.brightGreen);
  }

  info(text: string): string {
    return this.colorize(text, colors.brightBlue);
  }

  // Syntax highlighting
  rule(text: string): string {
    return this.colorize(text, colors.brightRed);
  }

  filename(text: string): string {
    return this.colorize(text, colors.brightBlue);
  }

  lineNumber(text: string): string {
    return this.colorize(text, colors.gray);
  }

  highlight(text: string): string {
    return this.colorize(text, colors.brightMagenta);
  }

  help(text: string): string {
    return this.colorize(text, colors.cyan);
  }

  // Code elements
  keyword(text: string): string {
    return this.colorize(text, colors.magenta);
  }

  string(text: string): string {
    return this.colorize(text, colors.green);
  }

  comment(text: string): string {
    return this.colorize(text, colors.gray);
  }

  // UI elements
  border(text: string): string {
    return this.colorize(text, colors.gray);
  }

  emphasis(text: string): string {
    return this.colorize(text, colors.bright);
  }

  muted(text: string): string {
    return this.colorize(text, colors.dim);
  }

  // Special formatting
  errorPointer(text: string): string {
    return this.colorize(text, colors.brightMagenta);
  }

  errorIcon(): string {
    return this.error('×');
  }

  warningIcon(): string {
    return this.warning('⚠️');
  }

  successIcon(): string {
    return this.success('✅');
  }

  infoIcon(): string {
    return this.info('💡');
  }
}