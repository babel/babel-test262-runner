"use strict";

const { transformSync, loadOptions } = require("@babel/core");
const presetEnv = require("@babel/preset-env");

const getBabelPlugins = require("./get-babel-plugins");

const configCaches = new Map();

function getOptions(features, isModule) {
  const featureKey = JSON.stringify(features);
  let config = configCaches.get(featureKey);
  if (config !== undefined) {
    return config;
  }
  config = loadOptions({
    configFile: false,
    presets: [[presetEnv, { spec: true }]],
    plugins: getBabelPlugins(features),
    sourceType: isModule ? "module" : "script",
  });

  configCaches.set(featureKey, config);
  return config;
}

module.exports = function transpile(code, features, isModule) {
  return transformSync(code, getOptions(features, isModule)).code;
};
