import type { ASTNode, StaticIssue } from "./types.js";

export interface StaticAnalysisResult {
  issues: StaticIssue[];
  analysisTimeMs: number;
}

export function runStaticAnalysis(ast: ASTNode, source: string): StaticAnalysisResult {
  const start = performance.now();
  const issues: StaticIssue[] = [];

  function visit(node: ASTNode, path: string[] = []): void {
    switch (node.type) {
      case "VariableDeclaration": {
        // Detect var without initialization used later — simplified heuristic
        if (node.children.length === 1) {
          issues.push({
            type: "UNINITIALIZED_VARIABLE",
            message: `Variable '${node.children[0]?.value ?? "?"}' declared without initialization`,
            line: node.line ?? 0,
            severity: "info",
            suggestion: `Consider initializing '${node.children[0]?.value ?? "?"}' at declaration time`,
          });
        }
        break;
      }

      case "IfStatement": {
        const cond = node.children[0];
        const thenBranch = node.children[1];
        const elseBranch = node.children[2];

        // Dead code: then branch with false condition
        if (cond?.type === "BooleanLiteral" && cond.value === "false") {
          issues.push({
            type: "DEAD_CODE",
            message: `Then-branch is dead code because condition is always false`,
            line: node.line ?? 0,
            severity: "warning",
            suggestion: "Remove the dead branch or fix the condition",
          });
        }

        // Dead code: else branch with true condition
        if (cond?.type === "BooleanLiteral" && cond.value === "true" && elseBranch) {
          issues.push({
            type: "DEAD_CODE",
            message: `Else-branch is dead code because condition is always true`,
            line: node.line ?? 0,
            severity: "warning",
            suggestion: "Remove the else branch or fix the condition",
          });
        }

        // Empty then branch
        if (thenBranch?.type === "BlockStatement" && thenBranch.children.length === 0) {
          issues.push({
            type: "EMPTY_BLOCK",
            message: `Empty if-block at line ${node.line ?? 0}`,
            line: node.line ?? 0,
            severity: "info",
            suggestion: "Add code to the block or remove the empty if statement",
          });
        }
        break;
      }

      case "WhileStatement": {
        const cond = node.children[0];
        const body = node.children[1];

        // Infinite loop detection
        if (cond?.type === "BooleanLiteral" && cond.value === "true") {
          const hasBreak = findNodeType(body ?? { type: "", value: "", line: null, children: [] }, "BreakStatement");
          const hasReturn = findNodeType(body ?? { type: "", value: "", line: null, children: [] }, "ReturnStatement");
          if (!hasBreak && !hasReturn) {
            issues.push({
              type: "INFINITE_LOOP",
              message: `while(true) loop with no break or return — potential infinite loop`,
              line: node.line ?? 0,
              severity: "error",
              suggestion: "Add a break or return statement inside the loop",
            });
          }
        }

        // Empty loop body
        if (body?.type === "BlockStatement" && body.children.length === 0) {
          issues.push({
            type: "EMPTY_BLOCK",
            message: `Empty while-loop body`,
            line: node.line ?? 0,
            severity: "warning",
            suggestion: "Add code to the loop body or remove the empty loop",
          });
        }
        break;
      }

      case "FunctionDeclaration": {
        const funcBody = node.children[1];
        if (!funcBody) break;

        // Functions that always return same constant (simplified heuristic)
        const allReturns = findAllNodes(funcBody, "ReturnStatement");
        if (allReturns.length > 0) {
          const constReturns = allReturns.filter(r => r.children[0]?.type === "NumberLiteral" || r.children[0]?.type === "StringLiteral" || r.children[0]?.type === "BooleanLiteral");
          if (constReturns.length === allReturns.length && constReturns.length > 1) {
            const uniqueValues = new Set(constReturns.map(r => r.children[0]?.value));
            if (uniqueValues.size === 1) {
              issues.push({
                type: "REDUNDANT_RETURN",
                message: `Function '${node.value}' always returns the same constant value '${constReturns[0]?.children[0]?.value}'`,
                line: node.line ?? 0,
                severity: "info",
                suggestion: "Simplify the function or use a constant instead",
              });
            }
          }
        }

        // High complexity — many nested ifs/loops
        const ifCount = findAllNodes(funcBody, "IfStatement").length;
        const loopCount = findAllNodes(funcBody, "WhileStatement").length + findAllNodes(funcBody, "ForStatement").length;
        if (ifCount + loopCount > 5) {
          issues.push({
            type: "COMPLEX_FUNCTION",
            message: `Function '${node.value}' has ${ifCount + loopCount} branches/loops — high cyclomatic complexity`,
            line: node.line ?? 0,
            severity: "warning",
            suggestion: "Break this function into smaller, focused functions",
          });
        }
        break;
      }

      case "BinaryExpression": {
        // Redundant computation: x + 0, x * 1, x - 0, x / 1
        const left = node.children[0];
        const right = node.children[1];
        if ((node.value === "+" || node.value === "-") && right?.type === "NumberLiteral" && parseFloat(right.value) === 0) {
          issues.push({
            type: "REDUNDANT_OPERATION",
            message: `Adding/subtracting 0 is a no-op: '${left?.value} ${node.value} 0'`,
            line: node.line ?? 0,
            severity: "info",
            suggestion: "Remove the redundant +0 or -0 operation",
          });
        }
        if ((node.value === "*" || node.value === "/") && right?.type === "NumberLiteral" && parseFloat(right.value) === 1) {
          issues.push({
            type: "REDUNDANT_OPERATION",
            message: `Multiplying/dividing by 1 is a no-op: '${left?.value} ${node.value} 1'`,
            line: node.line ?? 0,
            severity: "info",
            suggestion: "Remove the redundant *1 or /1 operation",
          });
        }
        // Multiply by 0
        if (node.value === "*" && (
          (right?.type === "NumberLiteral" && parseFloat(right.value) === 0) ||
          (left?.type === "NumberLiteral" && parseFloat(left.value) === 0)
        )) {
          issues.push({
            type: "REDUNDANT_OPERATION",
            message: `Multiplication by 0 always results in 0`,
            line: node.line ?? 0,
            severity: "info",
            suggestion: "Replace with the constant 0",
          });
        }
        // Division by zero
        if (node.value === "/" && right?.type === "NumberLiteral" && parseFloat(right.value) === 0) {
          issues.push({
            type: "DIVISION_BY_ZERO",
            message: `Division by zero detected`,
            line: node.line ?? 0,
            severity: "error",
            suggestion: "Add a zero-check before division",
          });
        }
        break;
      }

      case "AssignmentExpression": {
        // Self-assignment: a = a
        const left = node.children[0];
        const right = node.children[1];
        if (left?.type === "Identifier" && right?.type === "Identifier" && left.value === right.value) {
          issues.push({
            type: "SELF_ASSIGNMENT",
            message: `Self-assignment '${left.value} = ${right.value}' has no effect`,
            line: node.line ?? 0,
            severity: "warning",
            suggestion: "Remove the self-assignment",
          });
        }
        break;
      }

      case "ReturnStatement": {
        // Return followed by more code
        const parentPath = path;
        // simplified: we flag if return is not last in a block
        break;
      }
    }

    for (const child of node.children) {
      visit(child, [...path, node.type]);
    }
  }

  function findNodeType(root: ASTNode, type: string): boolean {
    if (root.type === type) return true;
    for (const child of root.children) {
      if (findNodeType(child, type)) return true;
    }
    return false;
  }

  function findAllNodes(root: ASTNode, type: string): ASTNode[] {
    const result: ASTNode[] = [];
    if (root.type === type) result.push(root);
    for (const child of root.children) {
      result.push(...findAllNodes(child, type));
    }
    return result;
  }

  // Check for dead code after return statements in blocks
  function checkDeadCodeAfterReturn(node: ASTNode): void {
    if (node.type === "BlockStatement") {
      let foundReturn = false;
      for (const child of node.children) {
        if (foundReturn) {
          issues.push({
            type: "DEAD_CODE",
            message: `Unreachable code after return statement`,
            line: child.line ?? 0,
            severity: "error",
            suggestion: "Remove the unreachable code",
          });
          break; // Only report first unreachable statement
        }
        if (child.type === "ReturnStatement") foundReturn = true;
      }
    }
    for (const child of node.children) {
      checkDeadCodeAfterReturn(child);
    }
  }

  // Check for duplicate if conditions
  function checkDuplicateConditions(node: ASTNode): void {
    if (node.type === "BlockStatement") {
      const conditions: string[] = [];
      for (const child of node.children) {
        if (child.type === "IfStatement" && child.children[0]) {
          const condStr = JSON.stringify(child.children[0]);
          if (conditions.includes(condStr)) {
            issues.push({
              type: "DUPLICATE_CONDITION",
              message: `Duplicate if-condition found in the same block`,
              line: child.line ?? 0,
              severity: "warning",
              suggestion: "Merge the duplicate conditions into one branch",
            });
          }
          conditions.push(condStr);
        }
      }
    }
    for (const child of node.children) {
      checkDuplicateConditions(child);
    }
  }

  visit(ast);
  checkDeadCodeAfterReturn(ast);
  checkDuplicateConditions(ast);

  return {
    issues,
    analysisTimeMs: performance.now() - start,
  };
}
