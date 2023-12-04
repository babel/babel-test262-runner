"use strict";

const requireBabel = require("./contextualize-require");
/**
 * @type {import("@babel/core")}
 */
const { transformSync, loadOptions } = requireBabel("@babel/core");
/**
 * @type {import("@babel/preset-env")}
 */
const presetEnv = requireBabel("@babel/preset-env");

const getBabelPlugins = require("./get-babel-plugins");

const configCaches = new Map();

function getOptions(features, isModule, isStrict) {
  const configKey = JSON.stringify({ features, isModule, isStrict });
  let config = configCaches.get(configKey);
  if (config !== undefined) {
    return config;
  }
  config = loadOptions({
    configFile: false,
    presets: [[presetEnv, { spec: true }]],
    plugins: getBabelPlugins(features),
    sourceType: isModule ? "module" : "script",
    highlightCode: false,
    generatorOpts: { minified: true },
    parserOpts: { strictMode: isStrict }
  });

  configCaches.set(configKey, config);
  return config;
}

module.exports = function transpile(code, { features, isModule, isStrict } = {}) {
  const ret = transformSync(code, getOptions(features || [], Boolean(isModule), Boolean(isStrict))).code;
  return ret;
};
