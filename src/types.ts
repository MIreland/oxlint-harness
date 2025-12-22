export interface OxlintDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  labels: Array<{
    span: {
      start: number;
      end: number;
    };
    message: string;
  }>;
  rule_id?: string;
  help?: string;
  url?: string;
}

export interface OxlintOutput {
  [filename: string]: OxlintDiagnostic[];
}

export interface SuppressionRule {
  count: number;
}

export interface SuppressionFile {
  [filename: string]: {
    [ruleName: string]: SuppressionRule;
  };
}

export interface ProcessedDiagnostic {
  filename: string;
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  line?: number;
  column?: number;
  help?: string;
  url?: string;
}

export interface ExcessError {
  rule: string;
  filename: string;
  expected: number;
  actual: number;
  diagnostics: ProcessedDiagnostic[];
}