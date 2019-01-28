"use strict";

const featuresToPlugins = {
  "class-fields-public": require("@babel/plugin-proposal-class-properties"),
  "class-methods-private": require("@babel/plugin-proposal-private-methods"),
  "numeric-separator-literal": require("@babel/plugin-proposal-numeric-separator"),
  //"import.meta": require("@babel/plugin-syntax-import-meta"),
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

  return Array.from(feat, f => featuresToPlugins[f]).concat(defaultPlugins);
};
