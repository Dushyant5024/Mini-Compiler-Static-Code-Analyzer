# lexer.py

KEYWORDS = {
    "function",
    "return",
    "if",
    "else",
    "while",
    "for",
    "var"
}

OPERATORS = {
    "+", "-", "*", "/", "=",
    "==", "!=", "<", ">", "<=", ">="
}

DELIMITERS = {
    "(", ")", "{", "}", ";", ","
}


class Token:
    def __init__(self, token_type, value):
        self.token_type = token_type
        self.value = value

    def __repr__(self):
        return f"{self.token_type}: {self.value}"


class Lexer:
    def __init__(self, source_code):
        self.source_code = source_code.split()
        self.tokens = []

    def tokenize(self):
        for word in self.source_code:

            if word in KEYWORDS:
                self.tokens.append(Token("KEYWORD", word))

            elif word in OPERATORS:
                self.tokens.append(Token("OPERATOR", word))

            elif word in DELIMITERS:
                self.tokens.append(Token("DELIMITER", word))

            elif word.isdigit():
                self.tokens.append(Token("NUMBER", word))

            else:
                self.tokens.append(Token("IDENTIFIER", word))

        return self.tokens


if __name__ == "__main__":

    code = """
    function add(a, b) {
        return a + b;
    }
    """

    lexer = Lexer(code)

    tokens = lexer.tokenize()

    for token in tokens:
        print(token)
