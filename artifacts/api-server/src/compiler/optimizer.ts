import type { ASTNode, OptimizationPass } from "./types.js";

export interface OptimizerResult {
  passes: OptimizationPass[];
  optimizedAst: ASTNode;
  optimizedSource: string;
  optimizationTimeMs: number;
  totalEstimatedSpeedupPct: number;
  memoryReductionPct: number;
}

function cloneAst(node: ASTNode): ASTNode {
  return {
    type: node.type,
    value: node.value,
    line: node.line,
    children: node.children.map(cloneAst),
  };
}

function isNumber(node: ASTNode): boolean {
  return node.type === "NumberLiteral";
}

function numVal(node: ASTNode): number {
  return parseFloat(node.value);
}

function numNode(val: number, line: number | null): ASTNode {
  return { type: "NumberLiteral", value: String(val), line, children: [] };
}

function boolNode(val: boolean, line: number | null): ASTNode {
  return { type: "BooleanLiteral", value: String(val), line, children: [] };
}

// Pass 1: Constant Folding
// Evaluate binary expressions with constant operands
function constantFolding(node: ASTNode): { node: ASTNode; count: number } {
  let count = 0;
  const children = node.children.map(c => {
    const r = constantFolding(c);
    count += r.count;
    return r.node;
  });
  const n = { ...node, children };

  if (n.type === "BinaryExpression" && isNumber(n.children[0]!) && isNumber(n.children[1]!)) {
    const a = numVal(n.children[0]!);
    const b = numVal(n.children[1]!);
    let result: number | boolean | null = null;
    switch (n.value) {
      case "+": result = a + b; break;
      case "-": result = a - b; break;
      case "*": result = a * b; break;
      case "/": if (b !== 0) { result = a / b; } break;
      case "%": if (b !== 0) { result = a % b; } break;
      case "<": result = a < b; break;
      case ">": result = a > b; break;
      case "<=": result = a <= b; break;
      case ">=": result = a >= b; break;
      case "==": result = a === b; break;
      case "!=": result = a !== b; break;
    }
    if (result !== null) {
      count++;
      if (typeof result === "boolean") return { node: boolNode(result, n.line), count };
      return { node: numNode(result as number, n.line), count };
    }
  }

  // String concatenation folding
  if (n.type === "BinaryExpression" && n.value === "+" &&
      n.children[0]?.type === "StringLiteral" && n.children[1]?.type === "StringLiteral") {
    count++;
    return { node: { type: "StringLiteral", value: n.children[0].value + n.children[1].value, line: n.line, children: [] }, count };
  }

  return { node: n, count };
}

// Pass 2: Constant Propagation
// Replace variables that are assigned constants with their values
function constantPropagation(node: ASTNode): { node: ASTNode; count: number } {
  const constants = new Map<string, ASTNode>();
  let count = 0;

  function propagate(n: ASTNode): ASTNode {
    if (n.type === "VariableDeclaration" && n.children.length === 2) {
      const nameNode = n.children[0];
      const valNode = n.children[1];
      if (nameNode && valNode && (valNode.type === "NumberLiteral" || valNode.type === "StringLiteral" || valNode.type === "BooleanLiteral")) {
        constants.set(nameNode.value, valNode);
      }
    }
    if (n.type === "AssignmentExpression" && n.children[0]?.type === "Identifier") {
      const right = n.children[1];
      if (right && (right.type === "NumberLiteral" || right.type === "StringLiteral" || right.type === "BooleanLiteral")) {
        constants.set(n.children[0].value, right);
      } else {
        constants.delete(n.children[0]?.value ?? "");
      }
    }
    if (n.type === "Identifier" && constants.has(n.value)) {
      count++;
      return { ...constants.get(n.value)!, line: n.line };
    }
    return { ...n, children: n.children.map(propagate) };
  }

  return { node: propagate(node), count };
}

// Pass 3: Dead Code Elimination
// Remove unreachable code after return statements
function deadCodeElimination(node: ASTNode): { node: ASTNode; count: number } {
  let count = 0;

  function eliminate(n: ASTNode): ASTNode {
    if (n.type === "BlockStatement") {
      const newChildren: ASTNode[] = [];
      let hasReturn = false;
      for (const child of n.children) {
        if (hasReturn) {
          count++;
          break;
        }
        newChildren.push(eliminate(child));
        if (child.type === "ReturnStatement") hasReturn = true;
      }
      return { ...n, children: newChildren };
    }
    if (n.type === "IfStatement") {
      const cond = n.children[0];
      if (cond?.type === "BooleanLiteral") {
        if (cond.value === "true") {
          count++;
          const thenBranch = n.children[1] ?? { type: "BlockStatement", value: "block", line: n.line, children: [] };
          return eliminate(thenBranch);
        }
        if (cond.value === "false") {
          count++;
          if (n.children[2]) return eliminate(n.children[2]);
          return { type: "BlockStatement", value: "block", line: n.line, children: [] };
        }
      }
    }
    if (n.type === "WhileStatement") {
      const cond = n.children[0];
      if (cond?.type === "BooleanLiteral" && cond.value === "false") {
        count++;
        return { type: "BlockStatement", value: "block", line: n.line, children: [] };
      }
    }
    return { ...n, children: n.children.map(eliminate) };
  }

  return { node: eliminate(node), count };
}

// Pass 4: Common Subexpression Elimination (simplified)
// Track expressions seen in a block and replace duplicates
function commonSubexpressionElimination(node: ASTNode): { node: ASTNode; count: number } {
  let count = 0;
  const seen = new Map<string, string>(); // expr string -> temp var name
  let tempIdx = 0;

  function exprKey(n: ASTNode): string {
    return `${n.type}:${n.value}:${n.children.map(exprKey).join(",")}`;
  }

  function cse(n: ASTNode): ASTNode {
    if (n.type === "BinaryExpression" && !n.children.some(c => c.type === "CallExpression")) {
      const key = exprKey(n);
      if (seen.has(key)) {
        count++;
        return { type: "Identifier", value: seen.get(key)!, line: n.line, children: [] };
      }
      const tempName = `_cse${tempIdx++}`;
      seen.set(key, tempName);
    }
    return { ...n, children: n.children.map(cse) };
  }

  return { node: cse(node), count };
}

// Pass 5: Redundant Operation Removal
function redundantOperationRemoval(node: ASTNode): { node: ASTNode; count: number } {
  let count = 0;

  function remove(n: ASTNode): ASTNode {
    if (n.type === "BinaryExpression") {
      const left = n.children[0];
      const right = n.children[1];

      // x + 0 = x, x - 0 = x
      if ((n.value === "+" || n.value === "-") && right?.type === "NumberLiteral" && parseFloat(right.value) === 0) {
        count++;
        return remove(left!);
      }
      // 0 + x = x
      if (n.value === "+" && left?.type === "NumberLiteral" && parseFloat(left.value) === 0) {
        count++;
        return remove(right!);
      }
      // x * 1 = x, x / 1 = x
      if ((n.value === "*" || n.value === "/") && right?.type === "NumberLiteral" && parseFloat(right.value) === 1) {
        count++;
        return remove(left!);
      }
      // 1 * x = x
      if (n.value === "*" && left?.type === "NumberLiteral" && parseFloat(left.value) === 1) {
        count++;
        return remove(right!);
      }
      // x * 0 = 0
      if (n.value === "*" && right?.type === "NumberLiteral" && parseFloat(right.value) === 0) {
        count++;
        return numNode(0, n.line);
      }
      if (n.value === "*" && left?.type === "NumberLiteral" && parseFloat(left.value) === 0) {
        count++;
        return numNode(0, n.line);
      }
    }

    // Double negation: !!x = x
    if (n.type === "UnaryExpression" && n.value === "!" && n.children[0]?.type === "UnaryExpression" && n.children[0].value === "!") {
      count++;
      return remove(n.children[0].children[0]!);
    }

    return { ...n, children: n.children.map(remove) };
  }

  return { node: remove(node), count };
}

// Pass 6: Loop Invariant Motion (simplified heuristic)
function loopInvariantMotion(node: ASTNode): { node: ASTNode; count: number } {
  let count = 0;

  function hoist(n: ASTNode): ASTNode {
    if (n.type === "WhileStatement" || n.type === "ForStatement") {
      const body = n.children[n.type === "WhileStatement" ? 1 : 3];
      if (!body) return n;

      // Find invariant computations (NumberLiteral binary expressions) in the body
      const hoisted: ASTNode[] = [];
      const newChildren = body.children.map(stmt => {
        if (stmt.type === "ExpressionStatement" && stmt.children[0]?.type === "BinaryExpression") {
          const expr = stmt.children[0];
          const left = expr.children[0];
          const right = expr.children[1];
          if (left?.type === "NumberLiteral" && right?.type === "NumberLiteral") {
            count++;
            hoisted.push(stmt);
            return null;
          }
        }
        return stmt;
      }).filter(Boolean) as ASTNode[];

      if (hoisted.length > 0) {
        const newBody = { ...body, children: newChildren };
        const newLoop = { ...n, children: n.children.map((c, i) => (i === (n.type === "WhileStatement" ? 1 : 3)) ? newBody : c) };
        return { type: "BlockStatement", value: "block", line: n.line, children: [...hoisted, newLoop] };
      }
    }
    return { ...n, children: n.children.map(hoist) };
  }

  return { node: hoist(node), count };
}

// Pass 7: Expression Simplification
function expressionSimplification(node: ASTNode): { node: ASTNode; count: number } {
  let count = 0;

  function simplify(n: ASTNode): ASTNode {
    if (n.type === "BinaryExpression") {
      const left = n.children[0];
      const right = n.children[1];
      // x - x = 0
      if (n.value === "-" && left?.type === "Identifier" && right?.type === "Identifier" && left.value === right.value) {
        count++;
        return numNode(0, n.line);
      }
      // x / x = 1 (ignoring zero)
      if (n.value === "/" && left?.type === "Identifier" && right?.type === "Identifier" && left.value === right.value) {
        count++;
        return numNode(1, n.line);
      }
      // x == x = true
      if (n.value === "==" && left?.type === "Identifier" && right?.type === "Identifier" && left.value === right.value) {
        count++;
        return boolNode(true, n.line);
      }
    }
    return { ...n, children: n.children.map(simplify) };
  }

  return { node: simplify(node), count };
}

function astToSource(node: ASTNode, indent = 0): string {
  const pad = "  ".repeat(indent);
  switch (node.type) {
    case "Program":
      return node.children.map(c => astToSource(c, indent)).join("\n");
    case "VariableDeclaration": {
      const name = node.children[0]?.value ?? "";
      const val = node.children[1] ? ` = ${astToSource(node.children[1])}` : "";
      return `${pad}${node.value} ${name}${val};`;
    }
    case "FunctionDeclaration": {
      const params = node.children[0]?.children.map(p => p.value).join(", ") ?? "";
      const body = node.children[1] ? astToSource(node.children[1], indent) : "{}";
      return `${pad}function ${node.value}(${params}) ${body}`;
    }
    case "BlockStatement":
      return `{\n${node.children.map(c => astToSource(c, indent + 1)).join("\n")}\n${pad}}`;
    case "IfStatement": {
      const cond = astToSource(node.children[0]!);
      const then = astToSource(node.children[1]!, indent);
      const els = node.children[2] ? ` else ${astToSource(node.children[2]!, indent)}` : "";
      return `${pad}if (${cond}) ${then}${els}`;
    }
    case "WhileStatement": {
      const cond = astToSource(node.children[0]!);
      const body = astToSource(node.children[1]!, indent);
      return `${pad}while (${cond}) ${body}`;
    }
    case "ForStatement": {
      const init = astToSource(node.children[0]!).trim().replace(/;$/, "");
      const cond = astToSource(node.children[1]!);
      const upd = astToSource(node.children[2]!).trim().replace(/;$/, "");
      const body = astToSource(node.children[3]!, indent);
      return `${pad}for (${init}; ${cond}; ${upd}) ${body}`;
    }
    case "ReturnStatement":
      return `${pad}return${node.children[0] ? " " + astToSource(node.children[0]) : ""};`;
    case "PrintStatement":
      return `${pad}print(${astToSource(node.children[0]!)});`;
    case "ExpressionStatement":
      return `${pad}${astToSource(node.children[0]!)};`;
    case "AssignmentExpression":
      return `${astToSource(node.children[0]!)} ${node.value} ${astToSource(node.children[1]!)}`;
    case "BinaryExpression":
      return `(${astToSource(node.children[0]!)} ${node.value} ${astToSource(node.children[1]!)})`;
    case "UnaryExpression":
      return `${node.value}${astToSource(node.children[0]!)}`;
    case "UpdateExpression": {
      const op = node.value.replace("prefix", "").replace("postfix", "");
      if (node.value.includes("prefix")) return `${op}${astToSource(node.children[0]!)}`;
      return `${astToSource(node.children[0]!)}${op}`;
    }
    case "CallExpression":
      return `${node.value}(${node.children.map(c => astToSource(c)).join(", ")})`;
    case "GroupExpression":
      return `(${astToSource(node.children[0]!)})`;
    case "Identifier":
    case "NumberLiteral":
    case "BooleanLiteral":
    case "NullLiteral":
      return node.value;
    case "StringLiteral":
      return `"${node.value}"`;
    case "BreakStatement":
      return `${pad}break;`;
    case "ContinueStatement":
      return `${pad}continue;`;
    default:
      return node.children.map(c => astToSource(c, indent)).join(" ");
  }
}

export function runOptimizations(ast: ASTNode): OptimizerResult {
  const start = performance.now();

  const passes: OptimizationPass[] = [];
  let current = cloneAst(ast);

  const runPass = (
    name: string,
    description: string,
    fn: (n: ASTNode) => { node: ASTNode; count: number },
    speedupPct: number
  ) => {
    const { node, count } = fn(current);
    current = node;
    passes.push({
      name,
      applied: count > 0,
      description,
      instancesFound: count,
      estimatedSpeedupPct: count > 0 ? speedupPct : 0,
    });
  };

  runPass("CONSTANT_FOLDING", "Evaluate constant expressions at compile time (e.g., 2 + 3 → 5)", constantFolding, 8);
  runPass("CONSTANT_PROPAGATION", "Replace variables with their known constant values", constantPropagation, 6);
  runPass("DEAD_CODE_ELIMINATION", "Remove unreachable code after return statements and constant branches", deadCodeElimination, 12);
  runPass("COMMON_SUBEXPRESSION_ELIMINATION", "Identify and reuse duplicate computations", commonSubexpressionElimination, 10);
  runPass("REDUNDANT_OPERATION_REMOVAL", "Remove no-op arithmetic (x+0, x*1, etc.)", redundantOperationRemoval, 5);
  runPass("LOOP_INVARIANT_MOTION", "Hoist constant computations out of loops", loopInvariantMotion, 15);
  runPass("EXPRESSION_SIMPLIFICATION", "Simplify algebraic identities (x-x=0, x==x=true)", expressionSimplification, 4);

  // Run constant folding again after propagation
  const { node: finalNode, count: finalFoldCount } = constantFolding(current);
  current = finalNode;
  if (finalFoldCount > 0) {
    const cfPass = passes.find(p => p.name === "CONSTANT_FOLDING");
    if (cfPass) {
      cfPass.instancesFound += finalFoldCount;
      cfPass.estimatedSpeedupPct = Math.min(20, cfPass.estimatedSpeedupPct + 2);
    }
  }

  const appliedPasses = passes.filter(p => p.applied);
  const totalSpeedup = Math.min(45, appliedPasses.reduce((acc, p) => acc + p.estimatedSpeedupPct, 0));
  const memoryReduction = Math.min(30, appliedPasses.length * 3);

  const optimizedSource = astToSource(current);

  return {
    passes,
    optimizedAst: current,
    optimizedSource,
    optimizationTimeMs: performance.now() - start,
    totalEstimatedSpeedupPct: totalSpeedup,
    memoryReductionPct: memoryReduction,
  };
}
