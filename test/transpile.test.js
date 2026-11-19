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
