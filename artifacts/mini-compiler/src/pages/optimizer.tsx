import type { CompileResult } from "@workspace/api-client-react";
import { Zap, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props { result: CompileResult | null; currentCode: string; }

const PASS_DESCRIPTIONS: Record<string, { emoji: string; detail: string }> = {
  CONSTANT_FOLDING:           { emoji: "f(x)", detail: "Evaluate constant expressions at compile-time instead of runtime: 3 + 4 → 7" },
  CONSTANT_PROPAGATION:       { emoji: "c→v", detail: "Replace variable references with their known constant values" },
  DEAD_CODE_ELIMINATION:      { emoji: "✗dc", detail: "Remove unreachable branches and statements after return" },
  COMMON_SUBEXPRESSION_ELIMINATION: { emoji: "CSE", detail: "Compute duplicate expressions once and reuse the result" },
  REDUNDANT_OPERATION_REMOVAL:{ emoji: "nop", detail: "Remove no-op arithmetic: x+0, x*1, x-0, x/1, x*0" },
  LOOP_INVARIANT_MOTION:      { emoji: "LIM", detail: "Hoist loop-invariant computations outside the loop body" },
  EXPRESSION_SIMPLIFICATION:  { emoji: "alg", detail: "Apply algebraic identities: x-x=0, x==x=true, !!x=x" },
};

export default function OptimizerPage({ result, currentCode }: Props) {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Zap className="h-10 w-10 text-muted-foreground mb-3" />
        <div className="text-sm font-medium text-foreground">No optimization results yet</div>
        <div className="text-xs text-muted-foreground mt-1">Run the pipeline from the Dashboard first</div>
      </div>
    );
  }

  const { passes, optimizedSource, optimizationTimeMs, totalEstimatedSpeedupPct } = result.optimization;
  const memoryReductionPct = result.optimization.memoryReductionPct ?? 0;
  const applied = passes.filter(p => p.applied);
  const totalInstances = passes.reduce((acc, p) => acc + (p.instancesFound ?? 0), 0);

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Optimization Passes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{applied.length} of {passes.length} passes applied in {optimizationTimeMs.toFixed(2)}ms</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded border border-border bg-card p-3 text-center">
          <div className="text-2xl font-mono font-bold text-primary">{totalEstimatedSpeedupPct.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground mt-0.5">Est. speedup</div>
        </div>
        <div className="rounded border border-border bg-card p-3 text-center">
          <div className="text-2xl font-mono font-bold text-accent">{memoryReductionPct.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground mt-0.5">Memory reduction</div>
        </div>
        <div className="rounded border border-border bg-card p-3 text-center">
          <div className="text-2xl font-mono font-bold text-foreground">{totalInstances}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Optimizations found</div>
        </div>
        <div className="rounded border border-border bg-card p-3 text-center">
          <div className="text-2xl font-mono font-bold text-foreground">{optimizationTimeMs.toFixed(2)}ms</div>
          <div className="text-xs text-muted-foreground mt-0.5">Time taken</div>
        </div>
      </div>

      {/* Passes list */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Optimization Passes</div>
        <div className="space-y-2">
          {passes.map((pass, i) => {
            const meta = PASS_DESCRIPTIONS[pass.name];
            return (
              <div
                key={i}
                data-testid={`pass-${pass.name}`}
                className={`rounded border p-3 flex items-start gap-3 transition-colors ${
                  pass.applied
                    ? "border-primary/25 bg-primary/5"
                    : "border-border bg-card opacity-60"
                }`}
              >
                <div className={`flex-shrink-0 rounded px-2 py-1 font-mono text-[10px] font-bold ${
                  pass.applied ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"
                }`}>
                  {meta?.emoji ?? "??"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-foreground">{pass.name}</span>
                    {pass.applied ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {pass.applied && (pass.instancesFound ?? 0) > 0 && (
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                        {pass.instancesFound} instance{pass.instancesFound !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {pass.applied && (pass.estimatedSpeedupPct ?? 0) > 0 && (
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-green-500/30 text-green-400">
                        +{(pass.estimatedSpeedupPct ?? 0).toFixed(0)}% speedup
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{pass.description}</div>
                  {meta?.detail && (
                    <div className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono">{meta.detail}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Before/After comparison */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Before / After Comparison</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-border overflow-hidden">
            <div className="border-b border-border px-3 py-2 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              </div>
              <span className="font-mono text-xs text-muted-foreground ml-2">Original</span>
              <Badge variant="secondary" className="ml-auto font-mono text-xs">{currentCode.split("\n").length} lines</Badge>
            </div>
            <pre className="text-xs font-mono p-3 overflow-auto max-h-[300px] text-muted-foreground bg-muted/5 leading-5">{currentCode || "// No source code"}</pre>
          </div>
          <div className="rounded border border-primary/25 overflow-hidden">
            <div className="border-b border-primary/25 px-3 py-2 flex items-center gap-2 bg-primary/5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              </div>
              <span className="font-mono text-xs text-primary ml-2">Optimized</span>
              <Badge variant="outline" className="ml-auto font-mono text-xs border-primary/30 text-primary">{optimizedSource.split("\n").length} lines</Badge>
            </div>
            <pre className="text-xs font-mono p-3 overflow-auto max-h-[300px] text-foreground leading-5">{optimizedSource || "// No output"}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
