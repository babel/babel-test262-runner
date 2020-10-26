"use strict";

let transpile; // = require("../transpile"); Circular dependency

module.exports = function ({ types: t }) {
  transpile = transpile || require("../transpile");

  return {
    name: "babel-test262/transform-eval",
    visitor: {
      CallExpression({ node }) {
        if (!t.isIdentifier(node.callee, { name: "eval" })) return;

        const arg = node.arguments[0];
        if (!t.isStringLiteral(arg)) return;
        try {
          arg.value = transpile(arg.value);
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
