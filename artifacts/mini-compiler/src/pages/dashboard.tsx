import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useCompileCode, useListSamples } from "@workspace/api-client-react";
import type { CompileResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Play, ChevronRight, Clock, AlertTriangle, CheckCircle, XCircle, Zap, FileText, Network, SearchCode, Binary } from "lucide-react";

interface Props {
  setResult: (r: CompileResult) => void;
  result: CompileResult | null;
  currentCode: string;
  setCurrentCode: (c: string) => void;
}

const DEFAULT_CODE = `// Welcome to mini_cc — Mini Compiler & Static Code Analyzer
// Load a sample program or write your own code below.

function fibonacci(n) {
  if (n <= 1) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

var result = fibonacci(10);
print(result);

// Optimizer will fold this constant expression
var x = 3 + 4 * 2;
var y = x + 0;     // redundant: +0
var z = x * 1;     // redundant: *1

print(y);
print(z);`;

const TOKEN_TYPE_COLORS: Record<string, string> = {
  KEYWORD: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  IDENTIFIER: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  NUMBER: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  STRING: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  OPERATOR: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  DELIMITER: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  BOOLEAN: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  NULL: "bg-orange-500/20 text-orange-300 border-orange-500/30",
};

function PipelineStage({ name, status, timeMs, itemCount, index }: {
  name: string; status: string; timeMs: number; itemCount: number; index: number;
}) {
  const isLast = index === 5;
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-center gap-1 min-w-[90px]">
        <div className={`w-full rounded border px-2 py-1.5 text-center text-xs font-mono transition-all ${
          status === "success" ? "border-green-500/40 bg-green-500/10 text-green-300" :
          status === "error" ? "border-red-500/40 bg-red-500/10 text-red-300" :
          status === "warning" ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300" :
          "border-border bg-card text-muted-foreground"
        }`}>
          <div className="font-medium text-[11px]">{name}</div>
          <div className="text-[10px] opacity-70">{timeMs.toFixed(1)}ms</div>
          <div className="text-[10px] opacity-70">{itemCount} items</div>
        </div>
      </div>
      {!isLast && (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-mono font-bold ${color ?? "text-foreground"}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function Dashboard({ setResult, result, currentCode, setCurrentCode }: Props) {
  const [code, setCode] = useState(currentCode || DEFAULT_CODE);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const compile = useCompileCode();
  const { data: samples } = useListSamples();

  const handleRun = useCallback(() => {
    if (!code.trim()) {
      toast({ title: "No code", description: "Enter some source code to compile.", variant: "destructive" });
      return;
    }
    compile.mutate(
      { data: { source: code, filename: "program.lang" } },
      {
        onSuccess: (data) => {
          setResult(data);
          setCurrentCode(code);
          toast({ title: "Compilation complete", description: `${data.pipeline.length} pipeline stages — ${data.totalTimeMs.toFixed(1)}ms` });
        },
        onError: () => {
          toast({ title: "Compilation failed", description: "Server error — check that the API is running.", variant: "destructive" });
        },
      }
    );
  }, [code, compile, setResult, setCurrentCode, toast]);

  const handleSampleChange = (id: string) => {
    const sample = samples?.find(s => s.id === id);
    if (sample) setCode(sample.source);
  };

  const errorCount = result?.errors?.length ?? 0;
  const warnCount = (result?.analysis?.semanticWarnings?.length ?? 0) + (result?.analysis?.staticIssues?.length ?? 0);
  const score = result?.maintainabilityScore ?? null;

  return (
    <div className="space-y-5 max-w-[1200px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Compiler Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Write or load source code, then run the full pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Select onValueChange={handleSampleChange}>
            <SelectTrigger className="w-52 h-8 text-xs" data-testid="select-sample">
              <SelectValue placeholder="Load sample program" />
            </SelectTrigger>
            <SelectContent>
              {(samples ?? []).map(s => (
                <SelectItem key={s.id} value={s.id} data-testid={`sample-${s.id}`}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={handleRun}
            disabled={compile.isPending}
            data-testid="button-run"
            className="gap-2 font-mono"
          >
            <Play className="h-3.5 w-3.5" />
            {compile.isPending ? "Compiling..." : "Run Pipeline"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Code Editor */}
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-3 py-2 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            <span className="font-mono text-xs text-muted-foreground ml-2">program.lang</span>
            <Badge variant="outline" className="ml-auto font-mono text-xs h-5">
              {code.split("\n").length} lines
            </Badge>
          </div>
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-muted/30 border-r border-border flex flex-col items-end pr-2 pt-2 pointer-events-none select-none overflow-hidden">
              {code.split("\n").map((_, i) => (
                <div key={i} className="text-[10px] font-mono text-muted-foreground leading-[1.5rem]">{i + 1}</div>
              ))}
            </div>
            <textarea
              data-testid="input-code"
              value={code}
              onChange={e => setCode(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  const newCode = code.substring(0, start) + "  " + code.substring(end);
                  setCode(newCode);
                  setTimeout(() => { e.currentTarget.selectionStart = e.currentTarget.selectionEnd = start + 2; }, 0);
                }
              }}
              className="w-full bg-transparent text-sm font-mono text-foreground pl-12 pr-4 pt-2 pb-4 resize-none outline-none leading-6 min-h-[420px]"
              spellCheck={false}
              placeholder="Write your code here..."
            />
          </div>
        </div>

        {/* Results Panel */}
        <div className="space-y-4">
          {/* Quick stats */}
          {result ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Maintainability Score"
                  value={`${score}/100`}
                  sub={score! >= 75 ? "Good quality" : score! >= 50 ? "Needs attention" : "Poor quality"}
                  color={score! >= 75 ? "text-green-400" : score! >= 50 ? "text-yellow-400" : "text-red-400"}
                />
                <StatCard
                  label="Total Pipeline Time"
                  value={`${result.totalTimeMs.toFixed(1)}ms`}
                  sub={`${result.tokens.length} tokens`}
                />
                <StatCard
                  label="Errors"
                  value={errorCount}
                  sub={errorCount === 0 ? "Clean compilation" : "See analysis tab"}
                  color={errorCount === 0 ? "text-green-400" : "text-red-400"}
                />
                <StatCard
                  label="Warnings & Issues"
                  value={warnCount}
                  sub={`${result.analysis.semanticWarnings?.length ?? 0} semantic, ${result.analysis.staticIssues?.length ?? 0} static`}
                  color={warnCount === 0 ? "text-green-400" : "text-yellow-400"}
                />
              </div>

              {/* Optimization gains */}
              <div className="rounded border border-border bg-card p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">Optimization Results</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-lg font-mono font-bold text-primary">{result.optimization.totalEstimatedSpeedupPct.toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">Est. speedup</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-mono font-bold text-accent">{(result.optimization.memoryReductionPct ?? 0).toFixed(0)}%</div>
                    <div className="text-xs text-muted-foreground">Mem reduction</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-mono font-bold text-foreground">{result.optimization.passes.filter(p => p.applied).length}</div>
                    <div className="text-xs text-muted-foreground">Passes applied</div>
                  </div>
                </div>
              </div>

              {/* Quick navigation */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { href: "/tokens", icon: FileText, label: "Token Stream", count: result.tokens.length },
                  { href: "/ast", icon: Network, label: "AST Explorer", count: null },
                  { href: "/analysis", icon: SearchCode, label: "Analysis", count: warnCount },
                  { href: "/ir", icon: Binary, label: "IR Code", count: result.ir.instructions.length },
                ].map(nav => (
                  <button
                    key={nav.href}
                    onClick={() => setLocation(nav.href)}
                    data-testid={`link-${nav.href.replace("/", "")}`}
                    className="flex items-center gap-2 rounded border border-border bg-card hover:bg-accent/10 hover:border-accent/30 p-2.5 text-left transition-colors"
                  >
                    <nav.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">{nav.label}</span>
                    {nav.count !== null && (
                      <Badge variant="secondary" className="ml-auto font-mono text-xs h-4 px-1">{nav.count}</Badge>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded border border-dashed border-border bg-card/50 flex flex-col items-center justify-center py-16 px-6 text-center h-full min-h-[300px]">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Play className="h-5 w-5 text-primary" />
              </div>
              <div className="text-sm font-medium text-foreground">Run the pipeline to see results</div>
              <div className="text-xs text-muted-foreground mt-1">Load a sample or write your own code, then click Run Pipeline</div>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Visualization */}
      {result && (
        <div className="rounded border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Pipeline Stages</span>
            <span className="text-xs text-muted-foreground ml-auto font-mono">{result.totalTimeMs.toFixed(2)}ms total</span>
          </div>
          <div className="flex items-start gap-1 flex-wrap">
            {result.pipeline.map((stage, i) => (
              <PipelineStage key={stage.name} {...stage} itemCount={stage.itemCount ?? 0} index={i} />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-3 w-3 text-green-400" />
              <span className="text-xs text-muted-foreground">success</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-yellow-400" />
              <span className="text-xs text-muted-foreground">warning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-3 w-3 text-red-400" />
              <span className="text-xs text-muted-foreground">error</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
