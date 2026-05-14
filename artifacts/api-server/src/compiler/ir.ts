import type { ASTNode, IRInstruction } from "./types.js";

export interface IRGeneratorResult {
  instructions: IRInstruction[];
  blocks: string[];
  irGenerationTimeMs: number;
}

export function generateIR(ast: ASTNode): IRGeneratorResult {
  const start = performance.now();
  const instructions: IRInstruction[] = [];
  let tempCount = 0;
  let labelCount = 0;
  let blockCount = 0;
  const blocks: string[] = ["entry"];
  let currentBlock = "entry";

  function newTemp(): string {
    return `t${tempCount++}`;
  }

  function newLabel(prefix = "L"): string {
    return `${prefix}${labelCount++}`;
  }

  function newBlock(prefix = "block"): string {
    const name = `${prefix}_${blockCount++}`;
    blocks.push(name);
    return name;
  }

  function emit(op: string, result: string, arg1: string | null = null, arg2: string | null = null): void {
    instructions.push({ op, result, arg1, arg2, block: currentBlock });
  }

  function emitLabel(label: string): void {
    currentBlock = label;
    if (!blocks.includes(label)) blocks.push(label);
    instructions.push({ op: "LABEL", result: label, arg1: null, arg2: null, block: label });
  }

  function genExpr(node: ASTNode): string {
    switch (node.type) {
      case "NumberLiteral":
        return node.value;
      case "StringLiteral":
        return `"${node.value}"`;
      case "BooleanLiteral":
        return node.value;
      case "NullLiteral":
        return "null";
      case "Identifier":
        return node.value;

      case "BinaryExpression": {
        const left = genExpr(node.children[0]!);
        const right = genExpr(node.children[1]!);
        const t = newTemp();
        const opMap: Record<string, string> = {
          "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV", "%": "MOD",
          "==": "EQ", "!=": "NEQ", "<": "LT", ">": "GT", "<=": "LEQ", ">=": "GEQ",
          "&&": "AND", "||": "OR",
        };
        emit(opMap[node.value] ?? "BIN_OP", t, left, right);
        return t;
      }

      case "UnaryExpression": {
        const operand = genExpr(node.children[0]!);
        const t = newTemp();
        emit(node.value === "-" ? "NEG" : "NOT", t, operand);
        return t;
      }

      case "UpdateExpression": {
        const op = node.value.startsWith("++") ? "ADD" : "SUB";
        const id = genExpr(node.children[0]!);
        const t = newTemp();
        emit("ASSIGN", t, id);
        emit(op, id, id, "1");
        return node.value.includes("postfix") ? t : id;
      }

      case "AssignmentExpression": {
        const val = genExpr(node.children[1]!);
        const target = node.children[0]?.value ?? newTemp();
        if (node.value === "=") {
          emit("ASSIGN", target, val);
        } else {
          const opMap: Record<string, string> = { "+=": "ADD", "-=": "SUB", "*=": "MUL", "/=": "DIV" };
          const op = opMap[node.value] ?? "ADD";
          emit(op, target, target, val);
        }
        return target;
      }

      case "CallExpression": {
        const args: string[] = node.children.map(arg => genExpr(arg));
        for (const arg of args) {
          emit("PARAM", arg);
        }
        const t = newTemp();
        emit("CALL", t, node.value, String(args.length));
        return t;
      }

      case "GroupExpression":
        return genExpr(node.children[0]!);

      case "ArrayLiteral": {
        const elements = node.children.map(e => genExpr(e));
        const t = newTemp();
        emit("ARRAY_NEW", t, String(elements.length));
        for (let i = 0; i < elements.length; i++) {
          emit("ARRAY_SET", t, String(i), elements[i]!);
        }
        return t;
      }

      default:
        return newTemp();
    }
  }

  function genStmt(node: ASTNode): void {
    switch (node.type) {
      case "Program":
        for (const child of node.children) genStmt(child);
        break;

      case "VariableDeclaration": {
        const name = node.children[0]?.value ?? newTemp();
        if (node.children[1]) {
          const val = genExpr(node.children[1]);
          emit("ASSIGN", name, val);
        } else {
          emit("ASSIGN", name, "undefined");
        }
        break;
      }

      case "ExpressionStatement":
        if (node.children[0]) genExpr(node.children[0]);
        break;

      case "PrintStatement": {
        const arg = genExpr(node.children[0]!);
        emit("PARAM", arg);
        emit("CALL", newTemp(), "print", "1");
        break;
      }

      case "ReturnStatement": {
        const val = node.children[0] ? genExpr(node.children[0]) : "undefined";
        emit("RETURN", val);
        break;
      }

      case "BreakStatement":
        emit("JUMP", "__break__");
        break;

      case "ContinueStatement":
        emit("JUMP", "__continue__");
        break;

      case "BlockStatement":
        for (const child of node.children) genStmt(child);
        break;

      case "IfStatement": {
        const cond = genExpr(node.children[0]!);
        const thenLabel = newLabel("then");
        const elseLabel = newLabel("else");
        const endLabel = newLabel("end_if");

        emit("IF_FALSE", cond, elseLabel);
        emitLabel(thenLabel);
        genStmt(node.children[1]!);
        emit("JUMP", endLabel);
        emitLabel(elseLabel);
        if (node.children[2]) {
          genStmt(node.children[2]);
        }
        emitLabel(endLabel);
        break;
      }

      case "WhileStatement": {
        const startLabel = newLabel("while_start");
        const bodyLabel = newLabel("while_body");
        const endLabel = newLabel("while_end");

        emitLabel(startLabel);
        const cond = genExpr(node.children[0]!);
        emit("IF_FALSE", cond, endLabel);
        emitLabel(bodyLabel);
        genStmt(node.children[1]!);
        emit("JUMP", startLabel);
        emitLabel(endLabel);
        break;
      }

      case "ForStatement": {
        const initLabel = newLabel("for_init");
        const condLabel = newLabel("for_cond");
        const bodyLabel = newLabel("for_body");
        const updateLabel = newLabel("for_update");
        const endLabel = newLabel("for_end");

        emitLabel(initLabel);
        genStmt(node.children[0]!);
        emitLabel(condLabel);
        const cond = genExpr(node.children[1]!);
        emit("IF_FALSE", cond, endLabel);
        emitLabel(bodyLabel);
        genStmt(node.children[3]!);
        emitLabel(updateLabel);
        genExpr(node.children[2]!);
        emit("JUMP", condLabel);
        emitLabel(endLabel);
        break;
      }

      case "FunctionDeclaration": {
        const funcBlock = newBlock(`func_${node.value}`);
        const savedBlock = currentBlock;
        emitLabel(funcBlock);
        emit("FUNC_BEGIN", node.value);
        const params = node.children[0]?.children ?? [];
        for (const param of params) {
          emit("PARAM_DECL", param.value);
        }
        genStmt(node.children[1]!);
        emit("FUNC_END", node.value);
        currentBlock = savedBlock;
        break;
      }

      default:
        for (const child of node.children) genStmt(child);
    }
  }

  genStmt(ast);
  emit("HALT", "");

  return {
    instructions,
    blocks,
    irGenerationTimeMs: performance.now() - start,
  };
}
