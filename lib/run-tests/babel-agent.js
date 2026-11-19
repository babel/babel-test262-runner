"use strict";

const fs = require("fs");

const NodeAgent = require("eshost/lib/agents/node");

const transpile = require("./transpile");

const CORE_JS = require.resolve("core-js-bundle");

// The key under which eshost stores the process of the last evalScript call.
const CHILD_PROCESS = Symbol.for("cp");

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

  async evalScript(code, options) {
    const result = await super.evalScript(code, options);

    // eshost only looks for errors in stderr, and ignores how the process ended.
    if (!result.error && !this.isStopped) {
      const { exitCode, signalCode } = this[CHILD_PROCESS];
      if (exitCode !== 0) {
        const reason = signalCode
          ? `was killed by ${signalCode}`
          : `exited with code ${exitCode}`;
        result.error = {
          name: "EngineError",
          message: `The engine ${reason}: ${result.stderr.trim()}`,
          stack: [],
        };
      }
    }

    return result;
  }

  compile(code) {
    code = super.compile(code);

    code = code.replace(
      /(?<=var eshostContext = vm\.createContext\(\{)/,
      `exports: exports,`
    );
    code = code.replace(
      /(?=vm\.runInESHostContext\()/,
      `
        var fs=require("fs");
        var polyfills = ${POLYFILLS};
        for (var i = 0; i < polyfills.length; i++) {
          vm.runInESHostContext(polyfills[i]);
        }
      `
    );

    code = transpile(code);

    return code;
  }
};
