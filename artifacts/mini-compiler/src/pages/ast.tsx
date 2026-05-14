import { useState } from "react";
import type { CompileResult } from "@workspace/api-client-react";
import { Network, ChevronRight, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ASTNode {
  type: string;
  value: string;
  line: number | null;
  children: ASTNode[];
}

const NODE_COLORS: Record<string, string> = {
  Program: "text-primary",
  FunctionDeclaration: "text-blue-400",
  VariableDeclaration: "text-emerald-400",
  IfStatement: "text-yellow-400",
  WhileStatement: "text-orange-400",
  ForStatement: "text-orange-400",
  ReturnStatement: "text-purple-400",
  BlockStatement: "text-slate-400",
  BinaryExpression: "text-cyan-400",
  UnaryExpression: "text-cyan-400",
  AssignmentExpression: "text-amber-400",
  CallExpression: "text-rose-400",
  Identifier: "text-foreground",
  NumberLiteral: "text-amber-300",
  StringLiteral: "text-rose-300",
  BooleanLiteral: "text-cyan-300",
  NullLiteral: "text-muted-foreground",
  Parameters: "text-muted-foreground",
  Parameter: "text-green-300",
};

function ASTNodeView({ node, depth = 0, defaultOpen = true }: { node: ASTNode; depth?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen || depth <= 2);
  const hasChildren = node.children && node.children.length > 0;
  const color = NODE_COLORS[node.type] ?? "text-foreground";

  return (
    <div className="font-mono text-xs">
      <div
        className="flex items-center gap-1 py-0.5 hover:bg-muted/30 rounded px-1 cursor-pointer group"
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => hasChildren && setOpen(!open)}
        data-testid={`ast-node-${node.type}-${depth}`}
      >
        {hasChildren ? (
          open ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className={`font-semibold ${color}`}>{node.type}</span>
        {node.value && node.value !== "" && node.type !== "Program" && (
          <span className="text-muted-foreground ml-1">
            <span className="text-foreground/60">(</span>
            <span className={color}>{node.value.length > 30 ? node.value.slice(0, 30) + "…" : node.value}</span>
            <span className="text-foreground/60">)</span>
          </span>
        )}
        {node.line !== null && (
          <span className="ml-auto text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100">L{node.line}</span>
        )}
        {hasChildren && (
          <Badge variant="outline" className="ml-1 font-mono text-[9px] h-3.5 px-1 py-0 text-muted-foreground border-border">
            {node.children.length}
          </Badge>
        )}
      </div>
      {open && hasChildren && node.children.map((child, i) => (
        <ASTNodeView key={i} node={child} depth={depth + 1} defaultOpen={depth < 1} />
      ))}
    </div>
  );
}

function countNodes(node: ASTNode): number {
  return 1 + (node.children ?? []).reduce((acc, c) => acc + countNodes(c), 0);
}

interface Props { result: CompileResult | null; }

export default function ASTPage({ result }: Props) {
  const [expandAll, setExpandAll] = useState(false);

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Network className="h-10 w-10 text-muted-foreground mb-3" />
        <div className="text-sm font-medium text-foreground">No AST available</div>
        <div className="text-xs text-muted-foreground mt-1">Run the pipeline from the Dashboard first</div>
      </div>
    );
  }

  const totalNodes = countNodes(result.ast as unknown as ASTNode);

  return (
    <div className="space-y-4 max-w-[900px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">AST Explorer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{totalNodes} nodes — click any node to expand/collapse</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpandAll(v => !v)}
            data-testid="button-expand-all"
            className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 font-mono transition-colors"
          >
            {expandAll ? "Collapse All" : "Expand All"}
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(NODE_COLORS).slice(0, 10).map(([type, color]) => (
          <span key={type} className={`text-[10px] font-mono ${color}`}>{type}</span>
        ))}
      </div>

      <div className="rounded border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-3 py-2 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
          </div>
          <span className="font-mono text-xs text-muted-foreground ml-2">Abstract Syntax Tree</span>
        </div>
        <div className="p-3 overflow-auto max-h-[600px]">
          <ASTNodeView key={expandAll ? "expanded" : "normal"} node={result.ast as unknown as ASTNode} defaultOpen={!expandAll} />
        </div>
      </div>

      {/* Node type distribution */}
      <div className="rounded border border-border bg-card p-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">Node Type Distribution</div>
        <div className="flex flex-wrap gap-2">
          {(() => {
            const counts: Record<string, number> = {};
            function countByType(n: ASTNode) {
              counts[n.type] = (counts[n.type] ?? 0) + 1;
              n.children?.forEach(countByType);
            }
            countByType(result.ast as unknown as ASTNode);
            return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center gap-1.5 text-xs font-mono">
                <span className={NODE_COLORS[type] ?? "text-muted-foreground"}>{type}</span>
                <Badge variant="secondary" className="h-4 px-1 font-mono text-[10px]">{count}</Badge>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
