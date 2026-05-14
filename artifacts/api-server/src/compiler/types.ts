export type TokenType =
  | "KEYWORD"
  | "IDENTIFIER"
  | "NUMBER"
  | "STRING"
  | "OPERATOR"
  | "DELIMITER"
  | "COMMENT"
  | "BOOLEAN"
  | "NULL"
  | "EOF"
  | "UNKNOWN";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export interface CompilerError {
  phase: "lexer" | "parser" | "semantic" | "optimizer";
  message: string;
  line: number;
  column: number | null;
}

export interface ASTNode {
  type: string;
  value: string;
  line: number | null;
  children: ASTNode[];
}

export interface SymbolEntry {
  name: string;
  type: string;
  scope: string;
  line: number;
  used: boolean;
}

export interface SemanticWarning {
  type: string;
  message: string;
  line: number;
  severity: "error" | "warning" | "info";
}

export interface StaticIssue {
  type: string;
  message: string;
  line: number;
  severity: "error" | "warning" | "info";
  suggestion: string | null;
}

export interface OptimizationPass {
  name: string;
  applied: boolean;
  description: string;
  instancesFound: number;
  estimatedSpeedupPct: number;
}

export interface IRInstruction {
  op: string;
  result: string;
  arg1: string | null;
  arg2: string | null;
  block: string | null;
}

export interface PipelineStage {
  name: string;
  status: "success" | "error" | "warning" | "skipped";
  timeMs: number;
  itemCount: number;
}

export interface SampleProgram {
  id: string;
  name: string;
  description: string;
  source: string;
  category: "basic" | "loops" | "functions" | "advanced";
}
