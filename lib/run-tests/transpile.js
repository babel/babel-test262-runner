"use strict";

const { default: loadConfig } = require("@babel/core/lib/config");
const { runSync } = require("@babel/core/lib/transformation");
const presetEnv = require("@babel/preset-env");

const getBabelPlugins = require("./get-babel-plugins");

const configCaches = new Map();

function getOptions(features) {
  const featureKey = JSON.stringify(features);
  let config = configCaches.get(featureKey);
  if (config !== undefined) {
    return config;
  }
  config = loadConfig({
    configFile: false,
    presets: [[presetEnv, { spec: true }]],
    plugins: getBabelPlugins(features),
    sourceType: "script",
  });

  configCaches.set(featureKey, config);
  return config;
}

module.exports = function transpile(code, features) {
  return runSync(getOptions(features), code).code;
};
