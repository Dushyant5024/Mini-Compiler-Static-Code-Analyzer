# parser.py

class ASTNode:
    def __init__(self, node_type, value=None):
        self.node_type = node_type
        self.value = value
        self.children = []

    def add_child(self, child):
        self.children.append(child)

    def display(self, level=0):
        indent = "  " * level
        print(f"{indent}{self.node_type}: {self.value}")

        for child in self.children:
            child.display(level + 1)


class Parser:

    def __init__(self, tokens):
        self.tokens = tokens
        self.position = 0

    def current_token(self):
        if self.position < len(self.tokens):
            return self.tokens[self.position]
        return None

    def consume(self):
        self.position += 1

    def parse_function(self):

        token = self.current_token()

        if token.value != "function":
            raise SyntaxError("Expected function keyword")

        self.consume()

        function_name = self.current_token().value
        self.consume()

        root = ASTNode("FunctionDeclaration", function_name)

        while self.current_token() and self.current_token().value != "{":
            self.consume()

        self.consume()

        body = ASTNode("BlockStatement")

        while self.current_token() and self.current_token().value != "}":

            token = self.current_token()

            if token.value == "return":
                return_node = ASTNode("ReturnStatement")

                self.consume()

                expression = ASTNode(
                    "Expression",
                    self.current_token().value
                )

                return_node.add_child(expression)

                body.add_child(return_node)

            self.consume()

        root.add_child(body)

        return root


if __name__ == "__main__":

    class Token:
        def __init__(self, token_type, value):
            self.token_type = token_type
            self.value = value


    sample_tokens = [
        Token("KEYWORD", "function"),
        Token("IDENTIFIER", "add"),
        Token("DELIMITER", "("),
        Token("IDENTIFIER", "a"),
        Token("DELIMITER", ","),
        Token("IDENTIFIER", "b"),
        Token("DELIMITER", ")"),
        Token("DELIMITER", "{"),
        Token("KEYWORD", "return"),
        Token("IDENTIFIER", "a"),
        Token("OPERATOR", "+"),
        Token("IDENTIFIER", "b"),
        Token("DELIMITER", ";"),
        Token("DELIMITER", "}")
    ]

    parser = Parser(sample_tokens)

    ast = parser.parse_function()

    ast.display()
