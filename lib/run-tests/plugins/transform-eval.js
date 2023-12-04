"use strict";

let transpile; // = require("../transpile"); Circular dependency

module.exports = function ({ types: t }) {
  transpile = transpile || require("../transpile");

  return {
    name: "babel-test262/transform-eval",
    visitor: {
      CallExpression(path) {
        const { node } = path;
        if (!t.isIdentifier(node.callee, { name: "eval" })) return;

        const arg = node.arguments[0];
        if (!t.isStringLiteral(arg)) return;

        const isModule = path.find(p => p.isProgram()).node.sourceType === "module";
        const isStrict = path.isInStrictMode();
        try {
          arg.value = transpile(arg.value, { isModule, isStrict });
        } catch (e) {
          if (e.code === "BABEL_PARSE_ERROR") {
            // transform `eval("const invalid")` to `eval("throw new SyntaxError()")`
            arg.value = "throw new SyntaxError(" + JSON.stringify(e.message) + ")";
          } else {
            // todo: Can we construct TypeError / ReferenceError from the raw error message?
            arg.value = "throw new Error("  + JSON.stringify(e.message) +  ")"
          }
        }
      },
    },
  };
};
