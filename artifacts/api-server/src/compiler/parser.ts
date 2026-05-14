import type { Token, ASTNode, CompilerError } from "./types.js";
import { tokenize } from "./lexer.js";

export interface ParseResult {
  ast: ASTNode;
  errors: CompilerError[];
  parseTimeMs: number;
  nodeCount: number;
  tokens: Token[];
  lexErrors: CompilerError[];
}

function node(type: string, value: string, line: number | null, children: ASTNode[] = []): ASTNode {
  return { type, value, line, children };
}

class Parser {
  private pos = 0;
  errors: CompilerError[] = [];
  private nodeCount = 0;

  constructor(private tokens: Token[]) {}

  private peek(offset = 0): Token {
    return this.tokens[this.pos + offset] ?? { type: "EOF", value: "", line: 0, column: 0 };
  }

  private advance(): Token {
    const t = this.tokens[this.pos];
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t!;
  }

  private check(type: string, value?: string): boolean {
    const t = this.peek();
    if (t.type !== type && t.value !== value && value !== undefined) return false;
    if (value !== undefined) return t.value === value;
    return t.type === type;
  }

  private checkVal(value: string): boolean {
    return this.peek().value === value;
  }

  private match(type: string, value?: string): Token | null {
    if (value !== undefined) {
      if (this.peek().value === value) return this.advance();
      return null;
    }
    if (this.peek().type === type) return this.advance();
    return null;
  }

  private expect(value: string, errorMsg?: string): Token {
    if (this.peek().value === value) return this.advance();
    this.errors.push({
      phase: "parser",
      message: errorMsg ?? `Expected '${value}', got '${this.peek().value || this.peek().type}'`,
      line: this.peek().line,
      column: this.peek().column,
    });
    return this.peek();
  }

  private mkNode(type: string, value: string, line: number | null, children: ASTNode[] = []): ASTNode {
    this.nodeCount++;
    return node(type, value, line, children);
  }

  parse(): ASTNode {
    const stmts: ASTNode[] = [];
    while (this.peek().type !== "EOF") {
      try {
        stmts.push(this.statement());
      } catch (e) {
        this.errors.push({ phase: "parser", message: `Parse error: ${String(e)}`, line: this.peek().line, column: null });
        this.advance();
      }
    }
    return this.mkNode("Program", "program", null, stmts);
  }

  private statement(): ASTNode {
    const t = this.peek();

    if (t.value === "var" || t.value === "let" || t.value === "const") {
      return this.varDecl();
    }
    if (t.value === "function") return this.funcDecl();
    if (t.value === "if") return this.ifStmt();
    if (t.value === "while") return this.whileStmt();
    if (t.value === "for") return this.forStmt();
    if (t.value === "return") return this.returnStmt();
    if (t.value === "break") {
      const line = t.line;
      this.advance();
      this.match("DELIMITER", ";");
      return this.mkNode("BreakStatement", "break", line);
    }
    if (t.value === "continue") {
      const line = t.line;
      this.advance();
      this.match("DELIMITER", ";");
      return this.mkNode("ContinueStatement", "continue", line);
    }
    if (t.value === "print") {
      const line = t.line;
      this.advance();
      this.expect("(");
      const arg = this.expression();
      this.expect(")");
      this.match("DELIMITER", ";");
      return this.mkNode("PrintStatement", "print", line, [arg]);
    }
    if (t.value === "{") {
      return this.block();
    }

    return this.exprStmt();
  }

  private varDecl(): ASTNode {
    const kw = this.advance();
    const nameToken = this.peek();
    if (nameToken.type !== "IDENTIFIER") {
      this.errors.push({ phase: "parser", message: `Expected variable name, got '${nameToken.value}'`, line: nameToken.line, column: nameToken.column });
    }
    this.advance();
    const children: ASTNode[] = [this.mkNode("Identifier", nameToken.value, nameToken.line)];
    if (this.checkVal("=")) {
      this.advance();
      children.push(this.expression());
    }
    this.match("DELIMITER", ";");
    return this.mkNode("VariableDeclaration", kw.value, kw.line, children);
  }

  private funcDecl(): ASTNode {
    const funcToken = this.advance();
    const nameToken = this.peek();
    this.advance();
    this.expect("(");
    const params: ASTNode[] = [];
    while (!this.checkVal(")") && this.peek().type !== "EOF") {
      const paramToken = this.peek();
      this.advance();
      params.push(this.mkNode("Parameter", paramToken.value, paramToken.line));
      if (!this.match("DELIMITER", ",")) break;
    }
    this.expect(")");
    const body = this.block();
    return this.mkNode("FunctionDeclaration", nameToken.value, funcToken.line, [
      this.mkNode("Parameters", "params", funcToken.line, params),
      body,
    ]);
  }

  private ifStmt(): ASTNode {
    const ifToken = this.advance();
    this.expect("(");
    const cond = this.expression();
    this.expect(")");
    const thenBranch = this.block();
    const children: ASTNode[] = [cond, thenBranch];
    if (this.checkVal("else")) {
      this.advance();
      if (this.checkVal("if")) {
        children.push(this.ifStmt());
      } else {
        children.push(this.block());
      }
    }
    return this.mkNode("IfStatement", "if", ifToken.line, children);
  }

  private whileStmt(): ASTNode {
    const whileToken = this.advance();
    this.expect("(");
    const cond = this.expression();
    this.expect(")");
    const body = this.block();
    return this.mkNode("WhileStatement", "while", whileToken.line, [cond, body]);
  }

  private forStmt(): ASTNode {
    const forToken = this.advance();
    this.expect("(");
    let init: ASTNode = this.mkNode("Empty", "", forToken.line);
    if (!this.checkVal(";")) {
      if (this.peek().value === "var" || this.peek().value === "let" || this.peek().value === "const") {
        init = this.varDecl();
      } else {
        init = this.exprStmt();
      }
    } else {
      this.advance();
    }
    let cond: ASTNode = this.mkNode("BooleanLiteral", "true", forToken.line);
    if (!this.checkVal(";")) {
      cond = this.expression();
    }
    this.expect(";");
    let update: ASTNode = this.mkNode("Empty", "", forToken.line);
    if (!this.checkVal(")")) {
      update = this.expression();
    }
    this.expect(")");
    const body = this.block();
    return this.mkNode("ForStatement", "for", forToken.line, [init, cond, update, body]);
  }

  private returnStmt(): ASTNode {
    const retToken = this.advance();
    if (this.checkVal(";") || this.peek().type === "EOF") {
      this.match("DELIMITER", ";");
      return this.mkNode("ReturnStatement", "return", retToken.line);
    }
    const val = this.expression();
    this.match("DELIMITER", ";");
    return this.mkNode("ReturnStatement", "return", retToken.line, [val]);
  }

  private block(): ASTNode {
    const openToken = this.peek();
    this.expect("{");
    const stmts: ASTNode[] = [];
    while (!this.checkVal("}") && this.peek().type !== "EOF") {
      try {
        stmts.push(this.statement());
      } catch (e) {
        this.errors.push({ phase: "parser", message: `Block parse error: ${String(e)}`, line: this.peek().line, column: null });
        this.advance();
      }
    }
    this.expect("}");
    return this.mkNode("BlockStatement", "block", openToken.line, stmts);
  }

  private exprStmt(): ASTNode {
    const expr = this.expression();
    this.match("DELIMITER", ";");
    return this.mkNode("ExpressionStatement", "expr", expr.line, [expr]);
  }

  private expression(): ASTNode {
    return this.assignment();
  }

  private assignment(): ASTNode {
    let left = this.logicalOr();
    if (this.checkVal("=") || this.checkVal("+=") || this.checkVal("-=") || this.checkVal("*=") || this.checkVal("/=")) {
      const op = this.advance();
      const right = this.assignment();
      return this.mkNode("AssignmentExpression", op.value, op.line, [left, right]);
    }
    return left;
  }

  private logicalOr(): ASTNode {
    let left = this.logicalAnd();
    while (this.checkVal("||")) {
      const op = this.advance();
      const right = this.logicalAnd();
      left = this.mkNode("BinaryExpression", op.value, op.line, [left, right]);
    }
    return left;
  }

  private logicalAnd(): ASTNode {
    let left = this.equality();
    while (this.checkVal("&&")) {
      const op = this.advance();
      const right = this.equality();
      left = this.mkNode("BinaryExpression", op.value, op.line, [left, right]);
    }
    return left;
  }

  private equality(): ASTNode {
    let left = this.comparison();
    while (this.checkVal("==") || this.checkVal("!=")) {
      const op = this.advance();
      const right = this.comparison();
      left = this.mkNode("BinaryExpression", op.value, op.line, [left, right]);
    }
    return left;
  }

  private comparison(): ASTNode {
    let left = this.additive();
    while (this.checkVal("<") || this.checkVal(">") || this.checkVal("<=") || this.checkVal(">=")) {
      const op = this.advance();
      const right = this.additive();
      left = this.mkNode("BinaryExpression", op.value, op.line, [left, right]);
    }
    return left;
  }

  private additive(): ASTNode {
    let left = this.multiplicative();
    while (this.checkVal("+") || this.checkVal("-")) {
      const op = this.advance();
      const right = this.multiplicative();
      left = this.mkNode("BinaryExpression", op.value, op.line, [left, right]);
    }
    return left;
  }

  private multiplicative(): ASTNode {
    let left = this.unary();
    while (this.checkVal("*") || this.checkVal("/") || this.checkVal("%")) {
      const op = this.advance();
      const right = this.unary();
      left = this.mkNode("BinaryExpression", op.value, op.line, [left, right]);
    }
    return left;
  }

  private unary(): ASTNode {
    if (this.checkVal("-") || this.checkVal("!") || this.checkVal("~")) {
      const op = this.advance();
      const operand = this.unary();
      return this.mkNode("UnaryExpression", op.value, op.line, [operand]);
    }
    if (this.checkVal("++") || this.checkVal("--")) {
      const op = this.advance();
      const operand = this.primary();
      return this.mkNode("UpdateExpression", `${op.value}prefix`, op.line, [operand]);
    }
    return this.postfix();
  }

  private postfix(): ASTNode {
    let expr = this.primary();
    if (this.checkVal("++") || this.checkVal("--")) {
      const op = this.advance();
      return this.mkNode("UpdateExpression", `${op.value}postfix`, op.line, [expr]);
    }
    return expr;
  }

  private primary(): ASTNode {
    const t = this.peek();

    if (t.type === "NUMBER") {
      this.advance();
      return this.mkNode("NumberLiteral", t.value, t.line);
    }
    if (t.type === "STRING") {
      this.advance();
      return this.mkNode("StringLiteral", t.value, t.line);
    }
    if (t.type === "BOOLEAN") {
      this.advance();
      return this.mkNode("BooleanLiteral", t.value, t.line);
    }
    if (t.type === "NULL") {
      this.advance();
      return this.mkNode("NullLiteral", "null", t.line);
    }
    if (t.type === "IDENTIFIER") {
      this.advance();
      if (this.checkVal("(")) {
        this.advance();
        const args: ASTNode[] = [];
        while (!this.checkVal(")") && this.peek().type !== "EOF") {
          args.push(this.expression());
          if (!this.match("DELIMITER", ",")) break;
        }
        this.expect(")");
        return this.mkNode("CallExpression", t.value, t.line, args);
      }
      if (this.checkVal("[")) {
        this.advance();
        const index = this.expression();
        this.expect("]");
        return this.mkNode("IndexExpression", t.value, t.line, [index]);
      }
      return this.mkNode("Identifier", t.value, t.line);
    }
    if (t.value === "(") {
      this.advance();
      const expr = this.expression();
      this.expect(")");
      return this.mkNode("GroupExpression", "group", t.line, [expr]);
    }
    if (t.value === "[") {
      this.advance();
      const elements: ASTNode[] = [];
      while (!this.checkVal("]") && this.peek().type !== "EOF") {
        elements.push(this.expression());
        if (!this.match("DELIMITER", ",")) break;
      }
      this.expect("]");
      return this.mkNode("ArrayLiteral", "array", t.line, elements);
    }
    if (t.value === "new") {
      this.advance();
      const className = this.peek();
      this.advance();
      this.expect("(");
      const args: ASTNode[] = [];
      while (!this.checkVal(")") && this.peek().type !== "EOF") {
        args.push(this.expression());
        if (!this.match("DELIMITER", ",")) break;
      }
      this.expect(")");
      return this.mkNode("NewExpression", className.value, className.line, args);
    }

    this.errors.push({
      phase: "parser",
      message: `Unexpected token: '${t.value || t.type}'`,
      line: t.line,
      column: t.column,
    });
    this.advance();
    return this.mkNode("Error", t.value, t.line);
  }

  getNodeCount(): number {
    return this.nodeCount;
  }
}

export function parseSource(source: string): ParseResult {
  const lexStart = performance.now();
  const { tokens, errors: lexErrors } = tokenize(source);
  const parseStart = performance.now();

  const parser = new Parser(tokens);
  const ast = parser.parse();
  const parseTimeMs = performance.now() - parseStart;

  return {
    ast,
    errors: parser.errors,
    parseTimeMs,
    nodeCount: parser.getNodeCount(),
    tokens,
    lexErrors,
  };
}
