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

        arg.value = transpile(arg.value);
      },
    },
  };
};
