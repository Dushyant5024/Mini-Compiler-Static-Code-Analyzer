import type { CompileResult } from "@workspace/api-client-react";
import { SearchCode, AlertTriangle, AlertCircle, Info, CheckCircle2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props { result: CompileResult | null; }

const SEV_CONFIG = {
  error:   { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/25", badge: "bg-red-500/20 text-red-300 border-red-500/30" },
  warning: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/25", badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  info:    { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/25", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
};

function IssueRow({ type, message, line, severity, suggestion }: {
  type: string; message: string; line: number; severity: string; suggestion?: string | null;
}) {
  const cfg = SEV_CONFIG[severity as keyof typeof SEV_CONFIG] ?? SEV_CONFIG.info;
  const Icon = cfg.icon;
  return (
    <div className={`rounded border p-3 ${cfg.bg}`} data-testid={`issue-${type}-${line}`}>
      <div className="flex items-start gap-2">
        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${cfg.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`font-mono text-[10px] px-1.5 py-0 ${cfg.badge}`}>{type}</Badge>
            <span className="text-xs text-muted-foreground font-mono">L{line}</span>
          </div>
          <div className="text-xs text-foreground mt-1">{message}</div>
          {suggestion && (
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-primary">Suggestion:</span> {suggestion}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalysisPage({ result }: Props) {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <SearchCode className="h-10 w-10 text-muted-foreground mb-3" />
        <div className="text-sm font-medium text-foreground">No analysis results yet</div>
        <div className="text-xs text-muted-foreground mt-1">Run the pipeline from the Dashboard first</div>
      </div>
    );
  }

  const { semanticWarnings = [], staticIssues = [], symbolTable = [] } = result.analysis;
  const maintainabilityScore = result.maintainabilityScore;
  const complexityScore = result.analysis.complexityScore ?? 0;

  const issueTypeCounts = [...semanticWarnings, ...staticIssues].reduce((acc, i) => {
    acc[i.type] = (acc[i.type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(issueTypeCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([type, count]) => ({ type: type.replace(/_/g, " "), count }));

  const scoreColor = maintainabilityScore >= 75 ? "#4ade80" : maintainabilityScore >= 50 ? "#facc15" : "#f87171";

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Static Analysis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{semanticWarnings.length} semantic warnings, {staticIssues.length} static issues</p>
        </div>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border border-border bg-card p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">Maintainability Score</div>
          <div className="text-4xl font-mono font-bold" style={{ color: scoreColor }}>{maintainabilityScore}</div>
          <div className="text-xs text-muted-foreground mt-1">/100</div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${maintainabilityScore}%`, backgroundColor: scoreColor }} />
          </div>
        </div>
        <div className="rounded border border-border bg-card p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">Cyclomatic Complexity</div>
          <div className={`text-4xl font-mono font-bold ${(complexityScore) <= 5 ? "text-green-400" : (complexityScore) <= 10 ? "text-yellow-400" : "text-red-400"}`}>{complexityScore}</div>
          <div className="text-xs text-muted-foreground mt-1">{(complexityScore) <= 5 ? "Low" : (complexityScore) <= 10 ? "Medium" : "High"} complexity</div>
        </div>
        <div className="rounded border border-border bg-card p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">Symbol Table</div>
          <div className="text-4xl font-mono font-bold text-foreground">{symbolTable.length}</div>
          <div className="text-xs text-muted-foreground mt-1">symbols defined</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Issue distribution chart */}
        {chartData.length > 0 && (
          <div className="rounded border border-border bg-card p-4">
            <div className="text-sm font-medium mb-3">Issue Distribution</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ left: -20 }}>
                <XAxis dataKey="type" tick={{ fontSize: 9, fill: "hsl(215 16% 52%)", fontFamily: "var(--app-font-mono)" }} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(215 16% 52%)" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(222 47% 9%)", border: "1px solid hsl(217 33% 18%)", borderRadius: "4px", fontSize: "11px", fontFamily: "var(--app-font-mono)" }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={["hsl(199 89% 48%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)", "hsl(265 60% 60%)", "hsl(0 72% 51%)"][i % 5]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Symbol table */}
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-3 py-2 flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">Symbol Table</span>
            <Badge variant="secondary" className="ml-auto font-mono text-xs">{symbolTable.length}</Badge>
          </div>
          <div className="overflow-auto max-h-[220px]">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-muted/30 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Name</th>
                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Type</th>
                  <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Scope</th>
                  <th className="text-right px-3 py-1.5 text-muted-foreground font-medium">Line</th>
                  <th className="text-center px-3 py-1.5 text-muted-foreground font-medium">Used</th>
                </tr>
              </thead>
              <tbody>
                {symbolTable.map((sym, i) => (
                  <tr key={i} data-testid={`sym-${sym.name}`} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/5"}`}>
                    <td className="px-3 py-1.5 text-foreground">{sym.name}</td>
                    <td className="px-3 py-1.5">
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 border-border text-muted-foreground">{sym.type}</Badge>
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{sym.scope}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{sym.line}</td>
                    <td className="px-3 py-1.5 text-center">
                      {sym.used ? <CheckCircle2 className="h-3 w-3 text-green-400 mx-auto" /> : <span className="text-red-400 text-[10px]">unused</span>}
                    </td>
                  </tr>
                ))}
                {symbolTable.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No symbols</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Semantic warnings */}
      {semanticWarnings.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            Semantic Warnings
            <Badge variant="secondary" className="font-mono text-xs">{semanticWarnings.length}</Badge>
          </div>
          <div className="space-y-2">
            {semanticWarnings.map((w, i) => (
              <IssueRow key={i} type={w.type} message={w.message} line={w.line} severity={w.severity ?? "info"} />
            ))}
          </div>
        </div>
      )}

      {/* Static issues */}
      {staticIssues.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400" />
            Static Issues
            <Badge variant="secondary" className="font-mono text-xs">{staticIssues.length}</Badge>
          </div>
          <div className="space-y-2">
            {staticIssues.map((issue, i) => (
              <IssueRow key={i} type={issue.type} message={issue.message} line={issue.line} severity={issue.severity ?? "info"} suggestion={issue.suggestion} />
            ))}
          </div>
        </div>
      )}

      {semanticWarnings.length === 0 && staticIssues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-green-500/30 rounded bg-green-500/5">
          <CheckCircle2 className="h-8 w-8 text-green-400 mb-2" />
          <div className="text-sm font-medium text-green-300">Clean analysis — no issues found</div>
        </div>
      )}
    </div>
  );
}
