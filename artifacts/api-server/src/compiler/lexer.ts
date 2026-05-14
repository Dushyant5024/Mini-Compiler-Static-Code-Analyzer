import type { Token, TokenType, CompilerError } from "./types.js";

const KEYWORDS = new Set([
  "var", "function", "return", "if", "else", "while", "for",
  "break", "continue", "true", "false", "null", "and", "or", "not",
  "print", "let", "const", "class", "new", "this", "typeof", "void",
]);

const OPERATORS = new Set([
  "+", "-", "*", "/", "%", "=", "==", "!=", "<", ">", "<=", ">=",
  "&&", "||", "!", "++", "--", "+=", "-=", "*=", "/=", "&", "|", "^", "~",
  "<<", ">>",
]);

export interface LexerResult {
  tokens: Token[];
  errors: CompilerError[];
  timeMs: number;
}

export function tokenize(source: string): LexerResult {
  const start = performance.now();
  const tokens: Token[] = [];
  const errors: CompilerError[] = [];
  let pos = 0;
  let line = 1;
  let lineStart = 0;

  function col(): number {
    return pos - lineStart + 1;
  }

  function peek(offset = 0): string {
    return source[pos + offset] ?? "";
  }

  function advance(): string {
    const ch = source[pos++]!;
    if (ch === "\n") {
      line++;
      lineStart = pos;
    }
    return ch;
  }

  function makeToken(type: TokenType, value: string, tokenLine: number, tokenCol: number): Token {
    return { type, value, line: tokenLine, column: tokenCol };
  }

  while (pos < source.length) {
    const tokenLine = line;
    const tokenCol = col();
    const ch = peek();

    if (ch === "\n" || ch === "\r" || ch === " " || ch === "\t") {
      advance();
      continue;
    }

    if (ch === "/" && peek(1) === "/") {
      let comment = "";
      while (pos < source.length && peek() !== "\n") {
        comment += advance();
      }
      tokens.push(makeToken("COMMENT", comment, tokenLine, tokenCol));
      continue;
    }

    if (ch === "/" && peek(1) === "*") {
      let comment = "/*";
      advance(); advance();
      while (pos < source.length && !(peek() === "*" && peek(1) === "/")) {
        comment += advance();
      }
      if (pos < source.length) {
        comment += advance();
        comment += advance();
      } else {
        errors.push({ phase: "lexer", message: "Unterminated block comment", line: tokenLine, column: tokenCol });
      }
      tokens.push(makeToken("COMMENT", comment, tokenLine, tokenCol));
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = advance();
      let str = "";
      while (pos < source.length && peek() !== quote) {
        if (peek() === "\\" && pos + 1 < source.length) {
          advance();
          const esc = advance();
          str += esc === "n" ? "\n" : esc === "t" ? "\t" : esc === "\\" ? "\\" : esc;
        } else if (peek() === "\n") {
          errors.push({ phase: "lexer", message: "Unterminated string literal", line: tokenLine, column: tokenCol });
          break;
        } else {
          str += advance();
        }
      }
      if (pos < source.length) advance();
      tokens.push(makeToken("STRING", str, tokenLine, tokenCol));
      continue;
    }

    if (ch >= "0" && ch <= "9") {
      let num = "";
      while (pos < source.length && ((peek() >= "0" && peek() <= "9") || peek() === ".")) {
        num += advance();
      }
      tokens.push(makeToken("NUMBER", num, tokenLine, tokenCol));
      continue;
    }

    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      let ident = "";
      while (pos < source.length && ((peek() >= "a" && peek() <= "z") || (peek() >= "A" && peek() <= "Z") || (peek() >= "0" && peek() <= "9") || peek() === "_")) {
        ident += advance();
      }
      if (ident === "true" || ident === "false") {
        tokens.push(makeToken("BOOLEAN", ident, tokenLine, tokenCol));
      } else if (ident === "null") {
        tokens.push(makeToken("NULL", ident, tokenLine, tokenCol));
      } else if (KEYWORDS.has(ident)) {
        tokens.push(makeToken("KEYWORD", ident, tokenLine, tokenCol));
      } else {
        tokens.push(makeToken("IDENTIFIER", ident, tokenLine, tokenCol));
      }
      continue;
    }

    if ("(){}[];,.:".includes(ch)) {
      advance();
      tokens.push(makeToken("DELIMITER", ch, tokenLine, tokenCol));
      continue;
    }

    const twoChar = ch + peek(1);
    if (["==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "<<", ">>"].includes(twoChar)) {
      advance(); advance();
      tokens.push(makeToken("OPERATOR", twoChar, tokenLine, tokenCol));
      continue;
    }

    if ("+-*/%=<>!&|^~".includes(ch)) {
      advance();
      tokens.push(makeToken("OPERATOR", ch, tokenLine, tokenCol));
      continue;
    }

    errors.push({ phase: "lexer", message: `Unknown character: '${ch}'`, line: tokenLine, column: tokenCol });
    tokens.push(makeToken("UNKNOWN", ch, tokenLine, tokenCol));
    advance();
  }

  tokens.push(makeToken("EOF", "", line, col()));

  return {
    tokens: tokens.filter(t => t.type !== "COMMENT"),
    errors,
    timeMs: performance.now() - start,
  };
}
