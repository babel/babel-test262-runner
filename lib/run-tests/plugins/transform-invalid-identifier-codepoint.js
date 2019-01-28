"use strict";

const hex = ch => ch.codePointAt(0).toString(16);
const invalidCP = /[^\w$]/;
const invalidCPg = new RegExp(invalidCP, "g");

module.exports = function ({ types: t }) {
  return {
    name: "babel-test262/transform-invalid-identifier-codepoints",
    visitor: {
      Identifier(path) {
        const { name } = path.node;
        if (!invalidCP.test(name)) return;

        if (path.isBindingIdentifier() || path.isReferencedIdentifier()) {
          path.node.name = name.replace(invalidCPg, ch => `$$u${hex(ch)}$$`);
        } else if (path.parentPath.isMemberExpression({ computed: false, property: path.node })) {
          path.parent.computed = true;
          path.replaceWith(t.stringLiteral(name));
        } else if (path.parentPath.isObjectProperty({ computed: false, key: path.node })) {
          path.replaceWith(t.stringLiteral(name));
        }
      },
    },
  };
};
