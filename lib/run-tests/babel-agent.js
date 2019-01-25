"use strict";

const NodeAgent = require("eshost/lib/agents/node");

const babel = require("@babel/core");
const presetEnv = require("@babel/preset-env");

class BabelAgent extends NodeAgent {
  compile(code) {
    code = transpile(code);
    code = super.compile(code);
    code = transpile(code);

    return code;
  }
}

BabelAgent.runtime = `
  ;require("core-js");

  // NodeAgent runtime

  ${transpile(BabelAgent.runtime)};
`;

module.exports = BabelAgent;

function transpile(code, sourceType = "script") {
  return babel.transformSync(code, {
    configFile: false,
    presets: [presetEnv],
    sourceType,
  }).code;
}
