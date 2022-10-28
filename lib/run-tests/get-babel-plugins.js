"use strict";

const requireBabel = require("./contextualize-require");

const featuresToPlugins = {
  "regexp-v-flag": requireBabel(
    "@babel/plugin-proposal-unicode-sets-regex"
  ),
  "decorators": [
    requireBabel("@babel/plugin-proposal-decorators"),
    { version: "2022-03" }
  ],
  "regexp-duplicate-named-groups": requireBabel(
    "@babel/plugin-proposal-duplicate-named-capturing-groups-regex"
  ),
};

const defaultPlugins = [
  require("./plugins/transform-invalid-identifier-codepoint"),
  require("./plugins/transform-eval"),
];

const aliases = {
  // "class-fields-private": "class-fields-public",
  // "class-static-fields-public": "class-fields-public",
  // "class-static-fields-private": "class-fields-public",
  // "class-static-methods-private": "class-methods-private",
};

module.exports = function getBabelPlugins(features = []) {
  const feat = new Set();
  for (const f of features) {
    if (featuresToPlugins[f]) feat.add(f);
    else if (aliases[f]) feat.add(aliases[f]);
  }

  return Array.from(feat, (f) => featuresToPlugins[f]).concat(defaultPlugins);
};
