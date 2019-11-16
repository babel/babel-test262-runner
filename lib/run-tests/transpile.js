"use strict";

const requireBabel = require('./contextualize-require');
const { transformSync, loadOptions } = requireBabel("@babel/core");
const presetEnv = requireBabel("@babel/preset-env");

const getBabelPlugins = require("./get-babel-plugins");

const configCaches = new Map();

function getOptions(features, isModule) {
  const configKey = JSON.stringify({ features, isModule });
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
  });

  configCaches.set(configKey, config);
  return config;
}

module.exports = function transpile(code, features, isModule) {
  return transformSync(code, getOptions(features, isModule)).code;
};
