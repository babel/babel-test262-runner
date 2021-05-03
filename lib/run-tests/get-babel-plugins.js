"use strict";

const requireBabel = require("./contextualize-require");

const featuresToPlugins = {
  "class-fields-public": requireBabel(
    "@babel/plugin-proposal-class-properties"
  ),
  "class-methods-private": requireBabel(
    "@babel/plugin-proposal-private-methods"
  ),
};

const defaultPlugins = [
  require("./plugins/transform-invalid-identifier-codepoint"),
  require("./plugins/transform-eval"),
];

const aliases = {
  "class-fields-private": "class-fields-public",
  "class-static-fields-public": "class-fields-public",
  "class-static-fields-private": "class-fields-public",
  "class-static-methods-private": "class-methods-private",
};

module.exports = function getBabelPlugins(features = []) {
  const feat = new Set();
  for (const f of features) {
    if (featuresToPlugins[f]) feat.add(f);
    else if (aliases[f]) feat.add(aliases[f]);
  }

  return Array.from(feat, (f) => featuresToPlugins[f]).concat(defaultPlugins);
};
