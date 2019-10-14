"use strict";

const fs = require("fs");

const NodeAgent = require("eshost/lib/agents/node");

const transpile = require("./transpile");

const CORE_JS = require.resolve("core-js-bundle");
const REGENERATOR = require.resolve("regenerator-runtime/runtime");

const POLYFILLS = `[
  fs.readFileSync(${JSON.stringify(CORE_JS)}, "utf8"),
  fs.readFileSync(${JSON.stringify(REGENERATOR)}, "utf8"),
]`;

class BabelAgent extends NodeAgent {
  compile(code) {
    code = super.compile(transpile(code));

    code = code.replace(
      /(?=vm\.runInESHostContext\()/,
      `
        var fs=require("fs");
        var polyfills = ${POLYFILLS};
        for (var i = 0; i < ${POLYFILLS.length}; i++) {
          vm.runInESHostContext(polyfills[i]);
        }
      `
    );

    code = transpile(code);

    return code;
  }
}

BabelAgent.runtime = fs.readFileSync(__dirname + "/babel-agent-runtime.js", "utf8")
  .replace(/\$POLYFILLS/g, POLYFILLS);

module.exports = BabelAgent;
