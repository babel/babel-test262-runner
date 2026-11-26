"use strict";

const assert = require("node:assert/strict");
const { describe, test } = require("node:test");
const vm = require("node:vm");

const transpile = require("../lib/run-tests/transpile");

function run(code, options, context = {}) {
  return vm.runInNewContext(transpile(code, options), context);
}

describe("transpile", () => {
  test("compiles down to ES5", () => {
    const code = transpile("const f = (a = 1) => `${a}`; class A {}");
    assert.doesNotMatch(code, /=>|\bconst\b|\bclass A\b|`/);
  });

  test("the output runs", () => {
    assert.equal(run("const f = (a = 1) => a + 1; f();"), 2);
  });

  test("keeps the spec behavior of arrow functions", () => {
    assert.throws(() => run("const f = () => {}; new f();"), {
      name: "TypeError",
    });
  });

  test("throws BABEL_PARSE_ERROR on invalid code", () => {
    assert.throws(() => transpile("let let;"), { code: "BABEL_PARSE_ERROR" });
  });

  test("compiles modules to CommonJS", () => {
    const exports = {};
    run("export var a = 1;", { isModule: true }, { exports });
    assert.equal(exports.a, 1);
  });

  test("parses as a script by default", () => {
    assert.throws(() => transpile("export var a = 1;"), {
      code: "BABEL_PARSE_ERROR",
    });
  });

  describe("isStrict", () => {
    test("makes scripts strict", () => {
      assert.equal(run("(function () { return this; })();", { isStrict: true }), undefined);
    });

    test("keeps the completion value of an empty program", () => {
      assert.equal(run("", { isStrict: true }), undefined);
    });

    test("does not add a second directive", () => {
      const code = transpile(`"use strict"; 1;`, { isStrict: true });
      assert.equal(code.match(/use strict/g).length, 1);
    });

    test("does not affect modules", () => {
      const code = transpile("1;", { isModule: true, isStrict: true });
      assert.doesNotMatch(code, /undefined;/);
    });
  });

  describe("features", () => {
    test("decorators are only enabled by their feature", () => {
      const source = "@dec class A {}";
      assert.throws(() => transpile(source), { code: "BABEL_PARSE_ERROR" });

      const context = { calls: 0 };
      run(
        `function dec() { calls++; } ${source}`,
        { features: ["decorators"] },
        context
      );
      assert.equal(context.calls, 1);
    });

    for (const [feature, source, isModule] of [
      ["import-defer", 'import defer * as ns from "./x.js";', true],
      ["import-defer", "import.defer(x);", false],
      ["source-phase-imports", 'import source s from "./x.wasm";', true],
      ["source-phase-imports", "import.source(x);", false],
    ]) {
      test(`${feature} enables \`${source}\``, () => {
        assert.throws(() => transpile(source, { isModule }), {
          code: "BABEL_PARSE_ERROR",
        });
        transpile(source, { features: [feature], isModule });
      });
    }

    test("options are not shared across different features", () => {
      transpile("@dec class A {}", { features: ["decorators"] });
      assert.throws(() => transpile("@dec class A {}", { features: [] }), {
        code: "BABEL_PARSE_ERROR",
      });
    });

    test("explicit resource management disposes the resource", () => {
      const context = { disposed: 0 };
      run(
        `var key = Symbol.dispose || Symbol.for("Symbol.dispose");
        { using x = { [key]() { disposed++; } }; }`,
        { features: ["explicit-resource-management"] },
        context
      );
      assert.equal(context.disposed, 1);
    });
  });
});

describe("transform-invalid-identifier-codepoint", () => {
  test("renames bindings and references", () => {
    const code = transpile("var ಠ = 1; ಠ;");
    assert.match(code, /var \$\$uca0\$\$=1;\$\$uca0\$\$;/);
    assert.equal(run("var ಠ = 1; ಠ + 1;"), 2);
  });

  test("keeps the original name of properties", () => {
    const context = {};
    run("var ಠ = 1; result = { ಠ, ಠ_: ಠ + 1 }; result.ಠ += 1;", {}, context);
    assert.deepEqual(Object.keys(context.result), ["ಠ", "ಠ_"]);
    assert.equal(context.result.ಠ, 2);
    assert.equal(context.result.ಠ_, 2);
  });

  test("does not touch valid ES5 identifiers", () => {
    assert.equal(transpile("var $a_1 = 1; $a_1.b_$;"), "var $a_1=1;$a_1.b_$;");
  });
});

describe("transform-eval", () => {
  test("compiles the source of direct eval calls", () => {
    assert.equal(transpile(`eval("let x = 1");`), `eval("var x=1;");`);
  });

  test("turns a parse error into a SyntaxError at runtime", () => {
    const code = `var ran = false; try { eval("let let"); ran = true; } catch (e) { e.name; }`;
    assert.equal(run(code), "SyntaxError");
  });

  test("compiling invalid eval code does not fail the whole file", () => {
    assert.doesNotThrow(() => transpile(`eval("let let");`));
  });

  test("propagates strict mode to the eval code", () => {
    const code = transpile(`"use strict"; eval("x;");`);
    assert.match(code, /eval\("\\"use strict\\";undefined;x;"\)/);
  });

  test("does not make eval code strict in sloppy scripts", () => {
    assert.equal(transpile(`eval("x;");`), `eval("x;");`);
  });

  test("ignores dynamic eval calls and other callees", () => {
    assert.equal(transpile("eval(code);"), "eval(code);");
    assert.equal(transpile(`foo("let x");`), `foo("let x");`);
    assert.equal(transpile(`(0, eval)("let x");`), `(0,eval)("let x");`);
  });
});

describe("transpileTest", () => {
  const { transpileTest } = transpile;

  // Like a test from @babel/test262-stream.
  function makeTest(harness, body, { strict = false, flags = {}, features } = {}) {
    const prefix = strict ? `"use strict";\n` : "";
    return {
      attrs: { flags, features },
      contents: prefix + harness + body,
      insertionIndex: prefix.length + harness.length,
    };
  }

  function runTest(test, context = {}) {
    return vm.runInNewContext(transpileTest(test), context);
  }

  test("runs the harness before the test", () => {
    const test = makeTest("var log = ['harness'];\n", "log.push('test'); log.join();");
    assert.equal(runTest(test), "harness,test");
  });

  test("compiles the test with the harness when they share no names", () => {
    const harness = "var add = (a, b) => a + b;\n";
    const test = makeTest(harness, "const x = add(1, 2); `${x}`;");
    assert.equal(runTest(test), "3");
  });

  test("the bindings Babel creates in the test do not override the harness", () => {
    // Both the harness and the test need a `_templateObject` for their tagged
    // templates.
    const harness = "function tag(s) { return s; }\nfunction fromHarness() { return tag`harness`[0]; }\n";
    const test = makeTest(harness, "tag`test`; fromHarness();");
    assert.equal(runTest(test), "harness");
  });

  test("block-scoped bindings of the test do not override the harness", () => {
    // Without the harness, Babel compiles the `let` to a `var check`, since
    // the test does not refer to any other `check`.
    const harness =
      "function check() { return 'harness'; }\nfunction callCheck() { return check(); }\n";
    const test = makeTest(harness, "{ let check = 'test'; } callCheck();");
    assert.equal(runTest(test), "harness");
  });

  test("the test can still override the harness's functions", () => {
    const harness = "function check() { return 'harness'; }\n";
    const test = makeTest(harness, "function check() { return 'test'; }\ncheck();");
    assert.equal(runTest(test), "test");
  });

  test("a test using a binding Babel created in the harness is compiled with it", () => {
    // The harness needs a `_typeof` helper.
    const harness = "function typeOf(x) { return typeof x; }\n";
    const body = "function _typeof() { return 'test'; }\ntypeOf(Symbol());";
    assert.equal(runTest(makeTest(harness, body)), "symbol");
  });

  test("redeclaring a `const` of the harness is a SyntaxError", () => {
    const test = makeTest("const value = 1;\n", "var value = 2;");
    assert.throws(() => transpileTest(test), { code: "BABEL_PARSE_ERROR" });
  });

  test("redeclaring a function of the harness with `let` is a SyntaxError", () => {
    const test = makeTest("function check() {}\n", "let check;");
    assert.throws(() => transpileTest(test), { code: "BABEL_PARSE_ERROR" });
  });

  test("reports syntax errors of the test", () => {
    const test = makeTest("var a;\n", "let let;");
    assert.throws(() => transpileTest(test), { code: "BABEL_PARSE_ERROR" });
  });

  test("the strict mode scenario makes the test strict", () => {
    const test = makeTest("var a;\n", "(function () { return this; })();", { strict: true });
    assert.equal(runTest(test), undefined);
  });

  test("a directive at the start of the test does not make it strict", () => {
    // In the whole test, it follows the harness.
    const test = makeTest("var a;\n", `"use strict";\n(function () { return typeof this; })();`);
    assert.equal(runTest(test), "object");
  });

  test("compiles modules as a whole", () => {
    const exports = {};
    const test = makeTest("var a = 1;\n", "export var b = a + 1;", { flags: { module: true } });
    runTest(test, { exports });
    assert.equal(exports.b, 2);
  });

  test("compiles tests without harness as a whole", () => {
    const test = { attrs: { flags: { raw: true } }, contents: "1 + 1;", insertionIndex: -1 };
    assert.equal(runTest(test), 2);
  });

  test("compiles the harness with the features of the test", () => {
    const context = { calls: 0 };
    const test = makeTest("function dec() { calls++; }\n@dec class A {}\n", "calls;", {
      features: ["decorators"],
    });
    assert.equal(runTest(test, context), 1);
  });
});
