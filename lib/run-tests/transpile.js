"use strict";

const babel = require("@babel/core");
const presetEnv = require("@babel/preset-env");

const getBabelPlugins = require("./get-babel-plugins");

module.exports = function transpile(code, features) {
  return babel.transformSync(code, {
    configFile: false,
    presets: [[presetEnv, { spec: true }]],
    plugins: getBabelPlugins(features),
    sourceType: "script",
  }).code;
};
