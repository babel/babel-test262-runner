"use strict";

const fs = require("fs");

const NodeAgent = require("eshost/lib/agents/node");

const transpile = require("./transpile");

const CORE_JS = require.resolve("core-js-bundle");

const POLYFILLS = `[
  'Function("this.globalThis = this;")()',
  fs.readFileSync(${JSON.stringify(CORE_JS)}, "utf8"),
]`;

module.exports = class BabelAgent extends NodeAgent {
  static runtime = fs
    .readFileSync(__dirname + "/babel-agent-runtime.js", "utf8")
    .replace(/\$POLYFILLS/g, POLYFILLS);

  constructor(options) {
    super({ shortName: "$262", ...options });
  }

  compile(code) {
    code = super.compile(code);

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
};
