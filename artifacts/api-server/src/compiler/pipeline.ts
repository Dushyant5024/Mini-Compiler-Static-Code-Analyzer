import { tokenize } from "./lexer.js";
import { parseSource } from "./parser.js";
import { analyzeSemantics } from "./semantic.js";
import { runStaticAnalysis } from "./staticAnalyzer.js";
import { runOptimizations } from "./optimizer.js";
import { generateIR } from "./ir.js";
import type { PipelineStage, CompilerError, Token, ASTNode } from "./types.js";

export interface FullCompileResult {
  tokens: Token[];
  ast: ASTNode;
  analysis: {
    semanticWarnings: ReturnType<typeof analyzeSemantics>["warnings"];
    staticIssues: ReturnType<typeof runStaticAnalysis>["issues"];
    maintainabilityScore: number;
    analysisTimeMs: number;
    symbolTable: ReturnType<typeof analyzeSemantics>["symbolTable"];
    complexityScore: number;
  };
  optimization: {
    passes: ReturnType<typeof runOptimizations>["passes"];
    optimizedSource: string;
    optimizationTimeMs: number;
    totalEstimatedSpeedupPct: number;
    memoryReductionPct: number;
  };
  ir: ReturnType<typeof generateIR>;
  pipeline: PipelineStage[];
  totalTimeMs: number;
  errors: CompilerError[];
  maintainabilityScore: number;
}

export function runFullPipeline(source: string): FullCompileResult {
  const globalStart = performance.now();
  const errors: CompilerError[] = [];
  const pipeline: PipelineStage[] = [];

  // Stage 1: Lexer
  const lexStart = performance.now();
  const { tokens, errors: lexErrors, timeMs: lexTime } = tokenize(source);
  errors.push(...lexErrors);
  pipeline.push({
    name: "Lexer",
    status: lexErrors.length > 0 ? "warning" : "success",
    timeMs: lexTime,
    itemCount: tokens.length,
  });

  // Stage 2: Parser
  const parseResult = parseSource(source);
  errors.push(...parseResult.errors);
  errors.push(...parseResult.lexErrors);
  pipeline.push({
    name: "Parser",
    status: parseResult.errors.length > 0 ? "warning" : "success",
    timeMs: parseResult.parseTimeMs,
    itemCount: parseResult.nodeCount,
  });

  // Stage 3: Semantic Analysis
  const semanticResult = analyzeSemantics(parseResult.ast);
  errors.push(...semanticResult.errors);
  pipeline.push({
    name: "Semantic",
    status: semanticResult.errors.length > 0 ? "error" : semanticResult.warnings.length > 0 ? "warning" : "success",
    timeMs: semanticResult.analysisTimeMs,
    itemCount: semanticResult.warnings.length + semanticResult.errors.length,
  });

  // Stage 4: Static Analysis
  const staticResult = runStaticAnalysis(parseResult.ast, source);
  pipeline.push({
    name: "Static Analysis",
    status: staticResult.issues.some(i => i.severity === "error") ? "error" : staticResult.issues.length > 0 ? "warning" : "success",
    timeMs: staticResult.analysisTimeMs,
    itemCount: staticResult.issues.length,
  });

  // Stage 5: Optimizer
  const optimResult = runOptimizations(parseResult.ast);
  pipeline.push({
    name: "Optimizer",
    status: optimResult.passes.some(p => p.applied) ? "success" : "warning",
    timeMs: optimResult.optimizationTimeMs,
    itemCount: optimResult.passes.filter(p => p.applied).length,
  });

  // Stage 6: IR Generator
  const irResult = generateIR(optimResult.optimizedAst);
  pipeline.push({
    name: "IR Generator",
    status: "success",
    timeMs: irResult.irGenerationTimeMs,
    itemCount: irResult.instructions.length,
  });

  return {
    tokens,
    ast: parseResult.ast,
    analysis: {
      semanticWarnings: semanticResult.warnings,
      staticIssues: staticResult.issues,
      maintainabilityScore: semanticResult.maintainabilityScore,
      analysisTimeMs: semanticResult.analysisTimeMs + staticResult.analysisTimeMs,
      symbolTable: semanticResult.symbolTable,
      complexityScore: semanticResult.complexityScore,
    },
    optimization: {
      passes: optimResult.passes,
      optimizedSource: optimResult.optimizedSource,
      optimizationTimeMs: optimResult.optimizationTimeMs,
      totalEstimatedSpeedupPct: optimResult.totalEstimatedSpeedupPct,
      memoryReductionPct: optimResult.memoryReductionPct,
    },
    ir: irResult,
    pipeline,
    totalTimeMs: performance.now() - globalStart,
    errors,
    maintainabilityScore: semanticResult.maintainabilityScore,
  };
}
