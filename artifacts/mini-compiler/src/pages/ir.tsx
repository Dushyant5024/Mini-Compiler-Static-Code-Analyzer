import { useState } from "react";
import type { CompileResult } from "@workspace/api-client-react";
import { Binary, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props { result: CompileResult | null; }

const OP_COLORS: Record<string, string> = {
  ASSIGN: "text-emerald-400",
  ADD: "text-cyan-400",
  SUB: "text-cyan-400",
  MUL: "text-cyan-400",
  DIV: "text-cyan-400",
  MOD: "text-cyan-400",
  NEG: "text-purple-400",
  NOT: "text-purple-400",
  EQ: "text-yellow-400",
  NEQ: "text-yellow-400",
  LT: "text-yellow-400",
  GT: "text-yellow-400",
  LEQ: "text-yellow-400",
  GEQ: "text-yellow-400",
  AND: "text-blue-400",
  OR: "text-blue-400",
  JUMP: "text-orange-400",
  IF_FALSE: "text-orange-400",
  LABEL: "text-primary font-bold",
  CALL: "text-rose-400",
  PARAM: "text-amber-400",
  RETURN: "text-purple-400",
  FUNC_BEGIN: "text-primary",
  FUNC_END: "text-muted-foreground",
  HALT: "text-muted-foreground",
};

export default function IRPage({ result }: Props) {
  const [blockFilter, setBlockFilter] = useState("ALL");

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Binary className="h-10 w-10 text-muted-foreground mb-3" />
        <div className="text-sm font-medium text-foreground">No IR output yet</div>
        <div className="text-xs text-muted-foreground mt-1">Run the pipeline from the Dashboard first</div>
      </div>
    );
  }

  const { instructions, blocks } = result.ir;

  const filtered = blockFilter === "ALL" ? instructions : instructions.filter(i => i.block === blockFilter);

  const opCounts = instructions.reduce((acc, i) => {
    acc[i.op] = (acc[i.op] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4 max-w-[1100px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Intermediate Representation</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Three-address code — {instructions.length} instructions across {blocks.length} basic blocks</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={blockFilter} onValueChange={setBlockFilter}>
            <SelectTrigger className="h-8 w-44 text-xs font-mono" data-testid="select-block-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All blocks ({instructions.length})</SelectItem>
              {blocks.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded border border-border bg-card p-3 text-center">
          <div className="text-xl font-mono font-bold text-foreground">{instructions.length}</div>
          <div className="text-xs text-muted-foreground">Instructions</div>
        </div>
        <div className="rounded border border-border bg-card p-3 text-center">
          <div className="text-xl font-mono font-bold text-primary">{blocks.length}</div>
          <div className="text-xs text-muted-foreground">Basic Blocks</div>
        </div>
        <div className="rounded border border-border bg-card p-3 text-center">
          <div className="text-xl font-mono font-bold text-accent">{opCounts.CALL ?? 0}</div>
          <div className="text-xs text-muted-foreground">Function Calls</div>
        </div>
        <div className="rounded border border-border bg-card p-3 text-center">
          <div className="text-xl font-mono font-bold text-foreground">{result.ir.irGenerationTimeMs.toFixed(2)}ms</div>
          <div className="text-xs text-muted-foreground">Gen Time</div>
        </div>
      </div>

      {/* Basic blocks */}
      <div className="flex flex-wrap gap-2">
        {blocks.map(b => (
          <button
            key={b}
            onClick={() => setBlockFilter(b === blockFilter ? "ALL" : b)}
            data-testid={`block-${b}`}
            className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
              blockFilter === b
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-border/80"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* IR instruction table */}
      <div className="rounded border border-border overflow-hidden">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-10">#</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-28">Block</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Op</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Result</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Arg1</th>
              <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Arg2</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((instr, i) => (
              <tr
                key={i}
                data-testid={`ir-row-${i}`}
                className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                  instr.op === "LABEL" ? "bg-primary/5" : i % 2 === 0 ? "bg-transparent" : "bg-muted/5"
                }`}
              >
                <td className="px-3 py-1.5 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[100px]">{instr.block}</td>
                <td className="px-3 py-1.5">
                  <span className={`font-bold ${OP_COLORS[instr.op] ?? "text-foreground"}`}>{instr.op}</span>
                </td>
                <td className="px-3 py-1.5 text-foreground">{instr.result || "—"}</td>
                <td className="px-3 py-1.5 text-foreground">{instr.arg1 ?? "—"}</td>
                <td className="px-3 py-1.5 text-foreground">{instr.arg2 ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No instructions in this block</div>
        )}
      </div>

      {/* Op legend */}
      <div className="rounded border border-border bg-card p-3">
        <div className="text-xs text-muted-foreground font-medium mb-2">Operation Distribution</div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(opCounts).sort((a, b) => b[1] - a[1]).map(([op, count]) => (
            <div key={op} className="flex items-center gap-1.5 text-xs font-mono">
              <span className={OP_COLORS[op] ?? "text-foreground"}>{op}</span>
              <Badge variant="secondary" className="h-4 px-1 font-mono text-[10px]">{count}</Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
