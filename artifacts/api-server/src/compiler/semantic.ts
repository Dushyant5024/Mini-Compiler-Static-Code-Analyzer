import type { ASTNode, SymbolEntry, SemanticWarning, CompilerError } from "./types.js";

interface Scope {
  name: string;
  symbols: Map<string, SymbolEntry>;
  parent: Scope | null;
}

export interface SemanticResult {
  warnings: SemanticWarning[];
  errors: CompilerError[];
  symbolTable: SymbolEntry[];
  maintainabilityScore: number;
  complexityScore: number;
  analysisTimeMs: number;
}

export function analyzeSemantics(ast: ASTNode): SemanticResult {
  const start = performance.now();
  const warnings: SemanticWarning[] = [];
  const errors: CompilerError[] = [];
  let tempCount = 0;

  const globalScope: Scope = { name: "global", symbols: new Map(), parent: null };

  function newScope(name: string, parent: Scope): Scope {
    return { name, symbols: new Map(), parent };
  }

  function lookupSymbol(name: string, scope: Scope): SymbolEntry | null {
    let s: Scope | null = scope;
    while (s) {
      const sym = s.symbols.get(name);
      if (sym) return sym;
      s = s.parent;
    }
    return null;
  }

  function defineSymbol(name: string, type: string, scope: Scope, line: number): SymbolEntry {
    const existing = scope.symbols.get(name);
    if (existing) {
      warnings.push({
        type: "DUPLICATE_DECLARATION",
        message: `Variable '${name}' is already declared in this scope (first declared at line ${existing.line})`,
        line,
        severity: "error",
      });
    }
    const entry: SymbolEntry = { name, type, scope: scope.name, line, used: false };
    scope.symbols.set(name, entry);
    return entry;
  }

  function collectAllSymbols(scope: Scope): SymbolEntry[] {
    const entries = Array.from(scope.symbols.values());
    return entries;
  }

  let cyclomaticComplexity = 1;
  let maxNestingDepth = 0;
  let currentNestingDepth = 0;
  let functionCount = 0;
  let longFunctionLines = 0;

  function visit(node: ASTNode, scope: Scope): void {
    switch (node.type) {
      case "Program":
        for (const child of node.children) visit(child, scope);
        break;

      case "VariableDeclaration": {
        const identNode = node.children[0];
        const name = identNode?.value ?? "unknown";
        defineSymbol(name, "variable", scope, node.line ?? 0);
        if (node.children[1]) visit(node.children[1], scope);
        break;
      }

      case "FunctionDeclaration": {
        const funcName = node.value;
        defineSymbol(funcName, "function", scope, node.line ?? 0);
        functionCount++;
        const funcScope = newScope(funcName, scope);
        const paramsNode = node.children[0];
        if (paramsNode) {
          for (const param of paramsNode.children) {
            defineSymbol(param.value, "parameter", funcScope, param.line ?? 0);
          }
        }
        currentNestingDepth++;
        if (currentNestingDepth > maxNestingDepth) maxNestingDepth = currentNestingDepth;
        if (node.children[1]) {
          const body = node.children[1];
          if (body.children.length > 50) {
            longFunctionLines++;
            warnings.push({
              type: "LONG_FUNCTION",
              message: `Function '${funcName}' has ${body.children.length} statements — consider breaking it up`,
              line: node.line ?? 0,
              severity: "warning",
            });
          }
          visit(body, funcScope);
        }
        currentNestingDepth--;

        // check for unused params
        for (const [, sym] of funcScope.symbols) {
          if (!sym.used && sym.type === "parameter") {
            warnings.push({
              type: "UNUSED_PARAMETER",
              message: `Parameter '${sym.name}' in function '${funcName}' is never used`,
              line: sym.line,
              severity: "info",
            });
          }
        }
        break;
      }

      case "IfStatement": {
        cyclomaticComplexity++;
        const cond = node.children[0];
        if (cond) {
          if (cond.type === "BooleanLiteral" && (cond.value === "true" || cond.value === "false")) {
            warnings.push({
              type: "UNREACHABLE_BRANCH",
              message: `Condition is always ${cond.value} — one branch is unreachable`,
              line: node.line ?? 0,
              severity: "warning",
            });
          }
          visit(cond, scope);
        }
        currentNestingDepth++;
        if (currentNestingDepth > maxNestingDepth) maxNestingDepth = currentNestingDepth;
        for (const child of node.children.slice(1)) visit(child, scope);
        currentNestingDepth--;
        break;
      }

      case "WhileStatement": {
        cyclomaticComplexity++;
        const cond = node.children[0];
        if (cond) {
          if (cond.type === "BooleanLiteral" && cond.value === "true") {
            warnings.push({
              type: "INFINITE_LOOP",
              message: `while(true) loop detected — ensure there is a break or return path`,
              line: node.line ?? 0,
              severity: "warning",
            });
          }
          visit(cond, scope);
        }
        currentNestingDepth++;
        if (currentNestingDepth > maxNestingDepth) maxNestingDepth = currentNestingDepth;
        if (node.children[1]) visit(node.children[1], scope);
        currentNestingDepth--;
        break;
      }

      case "ForStatement": {
        cyclomaticComplexity++;
        const forScope = newScope(`for_${tempCount++}`, scope);
        currentNestingDepth++;
        if (currentNestingDepth > maxNestingDepth) maxNestingDepth = currentNestingDepth;
        for (const child of node.children) visit(child, forScope);
        currentNestingDepth--;
        break;
      }

      case "BlockStatement": {
        for (const child of node.children) visit(child, scope);
        break;
      }

      case "ExpressionStatement":
      case "ReturnStatement":
      case "PrintStatement":
        for (const child of node.children) visit(child, scope);
        break;

      case "AssignmentExpression": {
        const left = node.children[0];
        const right = node.children[1];
        if (left && left.type === "Identifier") {
          const sym = lookupSymbol(left.value, scope);
          if (!sym) {
            errors.push({
              phase: "semantic",
              message: `Undefined variable '${left.value}'`,
              line: left.line ?? 0,
              column: null,
            });
          } else {
            sym.used = true;
          }
        }
        if (right) visit(right, scope);
        break;
      }

      case "Identifier": {
        const sym = lookupSymbol(node.value, scope);
        if (!sym) {
          // Only warn — not all identifiers need to be pre-declared (could be builtin)
          const builtins = new Set(["print", "console", "Math", "String", "Number", "Array", "Object", "parseInt", "parseFloat", "undefined", "NaN", "Infinity"]);
          if (!builtins.has(node.value)) {
            warnings.push({
              type: "UNDEFINED_VARIABLE",
              message: `Variable '${node.value}' is used but never declared`,
              line: node.line ?? 0,
              severity: "warning",
            });
          }
        } else {
          sym.used = true;
        }
        break;
      }

      case "BinaryExpression": {
        const left = node.children[0];
        const right = node.children[1];
        if (left && right) {
          // Detect duplicate conditions like (a == a)
          if (node.value === "==" || node.value === "!=") {
            if (left.type === "Identifier" && right.type === "Identifier" && left.value === right.value) {
              warnings.push({
                type: "DUPLICATE_CONDITION",
                message: `Comparing '${left.value}' with itself is always ${node.value === "==" ? "true" : "false"}`,
                line: node.line ?? 0,
                severity: "warning",
              });
            }
          }
          visit(left, scope);
          visit(right, scope);
        }
        break;
      }

      case "CallExpression": {
        const sym = lookupSymbol(node.value, scope);
        const builtinFuncs = new Set(["print", "console", "Math", "parseInt", "parseFloat", "String", "Number", "Array"]);
        if (!sym && !builtinFuncs.has(node.value)) {
          warnings.push({
            type: "UNDEFINED_FUNCTION",
            message: `Function '${node.value}' is called but never declared`,
            line: node.line ?? 0,
            severity: "warning",
          });
        } else if (sym) {
          sym.used = true;
        }
        for (const arg of node.children) visit(arg, scope);
        break;
      }

      default:
        for (const child of node.children) visit(child, scope);
    }
  }

  visit(ast, globalScope);

  // Check for unused variables
  const allSymbols = collectAllSymbols(globalScope);
  for (const sym of allSymbols) {
    if (!sym.used && sym.type === "variable") {
      warnings.push({
        type: "UNUSED_VARIABLE",
        message: `Variable '${sym.name}' is declared but never used`,
        line: sym.line,
        severity: "info",
      });
    }
    if (!sym.used && sym.type === "function") {
      warnings.push({
        type: "UNUSED_FUNCTION",
        message: `Function '${sym.name}' is declared but never called`,
        line: sym.line,
        severity: "warning",
      });
    }
  }

  // Collect all symbols from all scopes by traversing the AST again (simplified)
  function collectSymbolsFromAst(node: ASTNode, scopeDepth = 0, scopeName = "global"): SymbolEntry[] {
    const result: SymbolEntry[] = [];
    for (const [, sym] of globalScope.symbols) {
      if (!result.find(s => s.name === sym.name && s.scope === sym.scope)) {
        result.push(sym);
      }
    }
    return result;
  }

  const symbolTable = collectSymbolsFromAst(ast);

  // Compute maintainability score (0-100)
  // Based on cyclomatic complexity, nesting depth, issues, function length
  const complexityPenalty = Math.min(40, (cyclomaticComplexity - 1) * 2);
  const nestingPenalty = Math.min(20, maxNestingDepth * 4);
  const errorPenalty = Math.min(30, errors.length * 10);
  const warningPenalty = Math.min(20, warnings.filter(w => w.severity !== "info").length * 3);
  const rawScore = 100 - complexityPenalty - nestingPenalty - errorPenalty - warningPenalty;
  const maintainabilityScore = Math.max(0, Math.min(100, rawScore));

  return {
    warnings,
    errors,
    symbolTable: Array.from(globalScope.symbols.values()),
    maintainabilityScore: Math.round(maintainabilityScore),
    complexityScore: cyclomaticComplexity,
    analysisTimeMs: performance.now() - start,
  };
}
