import { Router } from "express";
import type { Request, Response } from "express";
import { tokenize } from "../compiler/lexer.js";
import { parseSource } from "../compiler/parser.js";
import { analyzeSemantics } from "../compiler/semantic.js";
import { runStaticAnalysis } from "../compiler/staticAnalyzer.js";
import { runOptimizations } from "../compiler/optimizer.js";
import { generateIR } from "../compiler/ir.js";
import { runFullPipeline } from "../compiler/pipeline.js";
import { recordRun, getStats } from "../compiler/stats.js";

const router = Router();

router.post("/tokenize", (req: Request, res: Response) => {
  const { source } = req.body as { source?: string };
  if (!source || typeof source !== "string") {
    res.status(400).json({ error: "source is required" });
    return;
  }
  const result = tokenize(source);
  res.json({
    tokens: result.tokens,
    errors: result.errors,
    tokenizationTimeMs: result.timeMs,
    tokenCount: result.tokens.length,
  });
});

router.post("/parse", (req: Request, res: Response) => {
  const { source } = req.body as { source?: string };
  if (!source || typeof source !== "string") {
    res.status(400).json({ error: "source is required" });
    return;
  }
  const result = parseSource(source);
  res.json({
    ast: result.ast,
    errors: result.errors,
    parseTimeMs: result.parseTimeMs,
    nodeCount: result.nodeCount,
  });
});

router.post("/analyze", (req: Request, res: Response) => {
  const { source } = req.body as { source?: string };
  if (!source || typeof source !== "string") {
    res.status(400).json({ error: "source is required" });
    return;
  }
  const { ast } = parseSource(source);
  const semantic = analyzeSemantics(ast);
  const staticRes = runStaticAnalysis(ast, source);
  res.json({
    semanticWarnings: semantic.warnings,
    staticIssues: staticRes.issues,
    maintainabilityScore: semantic.maintainabilityScore,
    analysisTimeMs: semantic.analysisTimeMs + staticRes.analysisTimeMs,
    symbolTable: semantic.symbolTable,
    complexityScore: semantic.complexityScore,
  });
});

router.post("/optimize", (req: Request, res: Response) => {
  const { source } = req.body as { source?: string };
  if (!source || typeof source !== "string") {
    res.status(400).json({ error: "source is required" });
    return;
  }
  const { ast } = parseSource(source);
  const result = runOptimizations(ast);
  res.json({
    passes: result.passes,
    optimizedSource: result.optimizedSource,
    optimizationTimeMs: result.optimizationTimeMs,
    totalEstimatedSpeedupPct: result.totalEstimatedSpeedupPct,
    memoryReductionPct: result.memoryReductionPct,
  });
});

router.post("/compile", (req: Request, res: Response) => {
  const { source, filename } = req.body as { source?: string; filename?: string };
  if (!source || typeof source !== "string") {
    res.status(400).json({ error: "source is required" });
    return;
  }
  const result = runFullPipeline(source);

  // Record stats
  recordRun({
    tokenizationMs: result.pipeline.find(s => s.name === "Lexer")?.timeMs ?? 0,
    parseMs: result.pipeline.find(s => s.name === "Parser")?.timeMs ?? 0,
    optimizationMs: result.optimization.optimizationTimeMs,
    maintainabilityScore: result.maintainabilityScore,
    issueTypes: [
      ...result.analysis.semanticWarnings.map(w => w.type),
      ...result.analysis.staticIssues.map(i => i.type),
    ],
  });

  res.json({
    tokens: result.tokens,
    ast: result.ast,
    analysis: result.analysis,
    optimization: result.optimization,
    ir: result.ir,
    pipeline: result.pipeline,
    totalTimeMs: result.totalTimeMs,
    errors: result.errors,
    maintainabilityScore: result.maintainabilityScore,
  });
});

router.post("/ir", (req: Request, res: Response) => {
  const { source } = req.body as { source?: string };
  if (!source || typeof source !== "string") {
    res.status(400).json({ error: "source is required" });
    return;
  }
  const { ast } = parseSource(source);
  const { optimizedAst } = runOptimizations(ast);
  const result = generateIR(optimizedAst);
  res.json({
    instructions: result.instructions,
    blocks: result.blocks,
    irGenerationTimeMs: result.irGenerationTimeMs,
  });
});

router.get("/stats", (_req: Request, res: Response) => {
  res.json(getStats());
});

export default router;
