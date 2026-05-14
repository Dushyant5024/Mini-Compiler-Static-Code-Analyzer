import { useRef } from "react";
import type { CompileResult } from "@workspace/api-client-react";
import { useGetCompilerStats } from "@workspace/api-client-react";
import { BarChart3, Download, CheckCircle, XCircle, AlertTriangle, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";

interface Props { result: CompileResult | null; }

export default function ReportPage({ result }: Props) {
  const { data: stats } = useGetCompilerStats();
  const reportRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!result) return;
    const lines: string[] = [
      "=== MINI COMPILER ANALYSIS REPORT ===",
      `Generated: ${new Date().toISOString()}`,
      "",
      "--- PIPELINE SUMMARY ---",
      ...result.pipeline.map(s => `  ${s.name}: ${s.status.toUpperCase()} (${s.timeMs.toFixed(2)}ms, ${s.itemCount} items)`),
      `  Total: ${result.totalTimeMs.toFixed(2)}ms`,
      "",
      "--- COMPILATION METRICS ---",
      `  Tokens: ${result.tokens.length}`,
      `  Maintainability Score: ${result.maintainabilityScore}/100`,
      `  Cyclomatic Complexity: ${result.analysis.complexityScore}`,
      `  Total Errors: ${result.errors.length}`,
      "",
      "--- SEMANTIC WARNINGS ---",
      ...((result.analysis.semanticWarnings ?? []).map(w => `  [${(w.severity ?? "info").toUpperCase()}] L${w.line} ${w.type}: ${w.message}`)),
      "",
      "--- STATIC ISSUES ---",
      ...((result.analysis.staticIssues ?? []).map(i => `  [${(i.severity ?? "info").toUpperCase()}] L${i.line} ${i.type}: ${i.message}${i.suggestion ? "\n    Suggestion: " + i.suggestion : ""}`)),
      "",
      "--- OPTIMIZATION PASSES ---",
      ...(result.optimization.passes.map(p => `  ${p.applied ? "[APPLIED]" : "[SKIPPED]"} ${p.name}: ${p.instancesFound ?? 0} instances, +${(p.estimatedSpeedupPct ?? 0).toFixed(0)}% speedup`)),
      `  Total Speedup: ${result.optimization.totalEstimatedSpeedupPct.toFixed(0)}%`,
      `  Memory Reduction: ${(result.optimization.memoryReductionPct ?? 0).toFixed(0)}%`,
      "",
      "--- SYMBOL TABLE ---",
      ...((result.analysis.symbolTable ?? []).map(s => `  ${s.name} (${s.type}) @ L${s.line} [${s.scope}] ${s.used ? "used" : "UNUSED"}`)),
      "",
      "--- COMPILER ERRORS ---",
      ...(result.errors.length > 0 ? result.errors.map(e => `  [${e.phase.toUpperCase()}] L${e.line}: ${e.message}`) : ["  None"]),
      "",
      "=== END OF REPORT ===",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compiler_report.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BarChart3 className="h-10 w-10 text-muted-foreground mb-3" />
        <div className="text-sm font-medium text-foreground">No report data yet</div>
        <div className="text-xs text-muted-foreground mt-1">Run the pipeline from the Dashboard first</div>
      </div>
    );
  }

  const pipelineChartData = result.pipeline.map(s => ({
    name: s.name,
    timeMs: Math.round(s.timeMs * 100) / 100,
    items: s.itemCount,
    status: s.status,
  }));

  const statusColors: Record<string, string> = {
    success: "#4ade80",
    warning: "#facc15",
    error: "#f87171",
    skipped: "#6b7280",
  };

  const issuesBySeverity = [
    { name: "Errors", value: result.errors.length, color: "#f87171" },
    { name: "Warnings", value: (result.analysis.semanticWarnings ?? []).filter(w => w.severity === "warning").length + (result.analysis.staticIssues ?? []).filter(i => i.severity === "warning").length, color: "#facc15" },
    { name: "Info", value: (result.analysis.semanticWarnings ?? []).filter(w => w.severity === "info").length + (result.analysis.staticIssues ?? []).filter(i => i.severity === "info").length, color: "#60a5fa" },
  ].filter(d => d.value > 0);

  const scoreColor = result.maintainabilityScore >= 75 ? "#4ade80" : result.maintainabilityScore >= 50 ? "#facc15" : "#f87171";

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Full Report</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete compilation analysis — generated {new Date().toLocaleTimeString()}</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleDownload} data-testid="button-download" className="gap-2 font-mono text-xs">
          <Download className="h-3.5 w-3.5" />
          Download .txt
        </Button>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Score", value: `${result.maintainabilityScore}/100`, color: scoreColor },
          { label: "Total Time", value: `${result.totalTimeMs.toFixed(1)}ms`, color: "hsl(199 89% 48%)" },
          { label: "Tokens", value: result.tokens.length, color: "hsl(210 40% 93%)" },
          { label: "Speedup", value: `+${(result.optimization.totalEstimatedSpeedupPct ?? 0).toFixed(0)}%`, color: "hsl(265 60% 60%)" },
          { label: "Issues", value: result.errors.length + (result.analysis.semanticWarnings?.length ?? 0) + (result.analysis.staticIssues?.length ?? 0), color: result.errors.length > 0 ? "#f87171" : "#4ade80" },
        ].map(c => (
          <div key={c.label} className="rounded border border-border bg-card p-3 text-center">
            <div className="text-2xl font-mono font-bold" style={{ color: c.color }}>{c.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Pipeline timing chart */}
        <div className="rounded border border-border bg-card p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Pipeline Stage Timing (ms)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pipelineChartData} margin={{ left: -20 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(215 16% 52%)", fontFamily: "var(--app-font-mono)" }} />
              <YAxis tick={{ fontSize: 9, fill: "hsl(215 16% 52%)" }} />
              <Tooltip
                contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 18%)", borderRadius: "4px", fontSize: "11px", fontFamily: "var(--app-font-mono)" }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                formatter={(v: number) => [`${v}ms`, "Time"]}
              />
              <Bar dataKey="timeMs" radius={[2, 2, 0, 0]}>
                {pipelineChartData.map((entry, i) => (
                  <Cell key={i} fill={statusColors[entry.status] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Issue severity distribution */}
        <div className="rounded border border-border bg-card p-4">
          <div className="text-sm font-medium mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            Issue Distribution by Severity
          </div>
          {issuesBySeverity.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={issuesBySeverity} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: "hsl(215 16% 52%)" }}>
                  {issuesBySeverity.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: "11px", fontFamily: "var(--app-font-mono)" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[170px]">
              <CheckCircle className="h-8 w-8 text-green-400 mb-2" />
              <span className="text-sm text-green-300">No issues detected</span>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline details */}
      <div className="rounded border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-3 py-2 text-sm font-medium">Pipeline Stage Details</div>
        <table className="w-full text-xs font-mono">
          <thead className="bg-muted/30 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium">Stage</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
              <th className="text-right px-3 py-2 text-muted-foreground font-medium">Time</th>
              <th className="text-right px-3 py-2 text-muted-foreground font-medium">Items</th>
            </tr>
          </thead>
          <tbody>
            {result.pipeline.map((stage, i) => (
              <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                <td className="px-3 py-2 text-foreground font-semibold">{stage.name}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {stage.status === "success" ? <CheckCircle className="h-3 w-3 text-green-400" /> :
                     stage.status === "error" ? <XCircle className="h-3 w-3 text-red-400" /> :
                     <AlertTriangle className="h-3 w-3 text-yellow-400" />}
                    <span className={stage.status === "success" ? "text-green-400" : stage.status === "error" ? "text-red-400" : "text-yellow-400"}>
                      {stage.status}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">{stage.timeMs.toFixed(2)}ms</td>
                <td className="px-3 py-2 text-right text-muted-foreground">{stage.itemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Optimizer summary */}
      <div className="rounded border border-border bg-card p-4">
        <div className="text-sm font-medium mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          Optimization Summary
        </div>
        <div className="grid grid-cols-2 gap-2">
          {result.optimization.passes.map((pass, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              {pass.applied ? (
                <CheckCircle className="h-3 w-3 text-green-400 shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-muted-foreground shrink-0" />
              )}
              <span className={pass.applied ? "text-foreground" : "text-muted-foreground"}>{pass.name}</span>
              {pass.applied && (pass.instancesFound ?? 0) > 0 && (
                <Badge variant="outline" className="ml-auto font-mono text-[9px] px-1 py-0 h-4 border-primary/25 text-primary">
                  {pass.instancesFound}×
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Global stats */}
      {stats && stats.totalRuns > 0 && (
        <div className="rounded border border-border bg-card p-4">
          <div className="text-sm font-medium mb-3">Session Statistics ({stats.totalRuns} runs)</div>
          <div className="grid grid-cols-4 gap-3 text-xs font-mono">
            <div><div className="text-muted-foreground">Avg tokenization</div><div className="text-foreground font-bold">{stats.avgTokenizationMs.toFixed(2)}ms</div></div>
            <div><div className="text-muted-foreground">Avg parse time</div><div className="text-foreground font-bold">{stats.avgParseMs.toFixed(2)}ms</div></div>
            <div><div className="text-muted-foreground">Avg optimization</div><div className="text-foreground font-bold">{stats.avgOptimizationMs.toFixed(2)}ms</div></div>
            <div><div className="text-muted-foreground">Avg score</div><div className={`font-bold ${stats.avgMaintainabilityScore >= 75 ? "text-green-400" : "text-yellow-400"}`}>{stats.avgMaintainabilityScore}/100</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
