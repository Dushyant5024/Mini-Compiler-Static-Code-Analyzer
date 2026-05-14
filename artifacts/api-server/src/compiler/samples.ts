import type { SampleProgram } from "./types.js";

export const SAMPLE_PROGRAMS: SampleProgram[] = [
  {
    id: "basic_vars",
    name: "Variable Operations",
    description: "Demonstrates variable declarations, arithmetic, and basic I/O — showcases constant folding and redundant operations",
    category: "basic",
    source: `// Basic variable operations
var x = 10;
var y = 20;
var z = x + y;

// Redundant operations (optimizer targets)
var a = z + 0;
var b = z * 1;
var c = z - 0;

// Constant expression folding
var result = 3 + 4 * 2;
var pi = 3.14159;
var area = pi * 5 * 5;

print(z);
print(result);
print(area);

// Unused variable (static analysis target)
var unused = 42;

// Uninitialized variable
var unset;`,
  },
  {
    id: "control_flow",
    name: "Control Flow & Branches",
    description: "If/else statements, dead code, and unreachable branches — showcases dead code elimination and semantic analysis",
    category: "basic",
    source: `var score = 85;
var grade;

if (score >= 90) {
  grade = "A";
} else if (score >= 80) {
  grade = "B";
} else if (score >= 70) {
  grade = "C";
} else {
  grade = "F";
}

print(grade);

// Dead code: always-true condition
if (true) {
  print("This always runs");
} else {
  print("This is dead code");
}

// Unreachable branch: always-false
if (false) {
  print("Never executes");
}

// Self-assignment (static analysis)
var val = 10;
val = val;

// Duplicate conditions
var flag = true;
if (flag) { print("flag is true"); }
if (flag) { print("flag is true again"); }`,
  },
  {
    id: "loops",
    name: "Loop Patterns",
    description: "For and while loops including loop invariant code, infinite loop detection, and optimization opportunities",
    category: "loops",
    source: `// Standard for loop
var sum = 0;
for (var i = 0; i < 10; i++) {
  sum = sum + i;
}
print(sum);

// While loop with counter
var count = 0;
var total = 0;
while (count < 5) {
  total = total + count * 2;
  count++;
}
print(total);

// Loop with invariant computation (optimizer: hoist out)
var multiplier = 4 * 3;
var results = 0;
for (var j = 0; j < 100; j++) {
  results = results + j * multiplier;
}

// Potential infinite loop
// while (true) { count++; }  -- commented out to avoid freezing

// Nested loops
for (var row = 0; row < 3; row++) {
  for (var col = 0; col < 3; col++) {
    print(row * 3 + col);
  }
}`,
  },
  {
    id: "functions",
    name: "Functions & Scope",
    description: "Function declarations, recursion, scope analysis, and unused function detection",
    category: "functions",
    source: `// Basic function
function add(a, b) {
  return a + b;
}

// Function with conditional logic
function max(x, y) {
  if (x > y) {
    return x;
  } else {
    return y;
  }
}

// Recursive function
function factorial(n) {
  if (n <= 1) {
    return 1;
  }
  return n * factorial(n - 1);
}

// Function calling other functions
function computeArea(r) {
  var pi = 3.14159;
  return pi * r * r;
}

// Dead code after return
function earlyReturn(val) {
  if (val > 0) {
    return val * 2;
  }
  return 0;
  var deadCode = 999;
  print(deadCode);
}

// Unused function (static analysis target)
function neverCalled(x) {
  return x + 1;
}

// Call the functions
var result1 = add(5, 3);
var result2 = max(10, 7);
var result3 = factorial(5);
var result4 = computeArea(3);
var result5 = earlyReturn(-1);

print(result1);
print(result2);
print(result3);
print(result4);
print(result5);`,
  },
  {
    id: "advanced_optimizations",
    name: "Optimization Showcase",
    description: "Code specifically designed to demonstrate all optimizer passes: constant folding, propagation, CSE, redundant ops",
    category: "advanced",
    source: `// Constant folding: all literals
var a = 2 + 3;          // folds to 5
var b = 10 - 4;         // folds to 6
var c = 3 * 4;          // folds to 12
var d = 20 / 5;         // folds to 4
var e = 2 + 3 * 4;      // folds to 14

// Constant propagation
var PI = 3.14;
var radius = 5;
var area = PI * radius * radius;   // propagates PI and radius

// Redundant operations
var x = 42;
var y = x + 0;    // x + 0 -> x
var z = x * 1;    // x * 1 -> x
var w = x - 0;    // x - 0 -> x
var q = x / 1;    // x / 1 -> x
var zero = x * 0; // x * 0 -> 0

// Common subexpressions
var p = 10;
var q2 = 20;
var expr1 = p + q2;
var expr2 = p + q2;   // same as expr1 - CSE
var expr3 = p + q2;   // same again

// Expression simplification
var val = x - x;       // x - x -> 0
var same = x == x;     // x == x -> true

// Double negation
var flag = true;
var notnot = !!flag;   // !!flag -> flag

// Dead code via constant condition
if (1 == 1) {
  print("always executed");
} else {
  print("dead code removed");
}

// Loop with invariant
var sum = 0;
for (var i = 0; i < 10; i++) {
  var inv = 5 + 3;   // loop invariant, can be hoisted
  sum = sum + i + inv;
}
print(sum);`,
  },
  {
    id: "semantic_errors",
    name: "Semantic Analysis Demo",
    description: "Code with semantic issues: undefined variables, duplicate declarations, scope violations, and type-related warnings",
    category: "advanced",
    source: `// Duplicate declaration
var name = "Alice";
var name = "Bob";   // duplicate in same scope!

// Undefined variable usage
print(undeclaredVar);

// Unused variables
var never_used_1 = 100;
var never_used_2 = 200;
var never_used_3 = 300;

// Undefined function call
var result = undeclaredFunction(42);

// Compare same identifier
var age = 25;
if (age == age) {
  print("Always true");
}

// Always-true while
function riskyLoop() {
  var i = 0;
  while (true) {
    i++;
    if (i > 100) {
      break;
    }
  }
  return i;
}

// Unused parameter
function compute(x, unusedParam) {
  return x * 2;
}

var r = riskyLoop();
var r2 = compute(5, 999);
print(r);
print(r2);`,
  },
];

export function getSampleById(id: string): SampleProgram | null {
  return SAMPLE_PROGRAMS.find(s => s.id === id) ?? null;
}
