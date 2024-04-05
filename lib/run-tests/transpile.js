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
    generatorOpts: { minified: true },
  });

  configCaches.set(configKey, config);
  return config;
}

module.exports = function transpile(code, { features, isModule, isStrict } = {}) {
  if (isStrict && !isModule && !/^\s*['"]use strict['"]/.test(code)) {
    // eval("") === undefined
    code = `"use strict";\nundefined;\n${code}`;
  }
  const ret = transformSync(code, getOptions(features || [], Boolean(isModule))).code;
  return ret;
};
