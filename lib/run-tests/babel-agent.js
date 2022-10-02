"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const NodeAgent = require("eshost/lib/agents/node");

const lmdb = require("lmdb");

const transpile = require("./transpile");

const CORE_JS = require.resolve("core-js-bundle");
const REGENERATOR = require.resolve("regenerator-runtime/runtime");

const POLYFILLS = `[
  fs.readFileSync(${JSON.stringify(CORE_JS)}, "utf8"),
  fs.readFileSync(${JSON.stringify(REGENERATOR)}, "utf8"),
]`;

let cache = lmdb.open({
  path: "cache.db",
  compression: true,
});

class BabelAgent extends NodeAgent {
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
}

BabelAgent.runtime = fs
  .readFileSync(__dirname + "/babel-agent-runtime.js", "utf8")
  .replace(/\$POLYFILLS/g, POLYFILLS);

//module.exports = BabelAgent;

const TEST_TIMEOUT = 60 * 1000; // 1 minute

function timeout(file, waitMs = TEST_TIMEOUT) {
  return new Promise((_resolve, reject) =>
    setTimeout(
      () => reject(new Error(`test ${file} timed out after ${waitMs} ms`)),
      waitMs
    )
  );
}

let agent;

module.exports = {
  runTest: async function (opts, test) {
    if (!agent) agent = new BabelAgent(opts);

    let { attrs, contents, file } = test;
    const isModule = attrs.flags.module;

    try {
      contents = transpile(contents, attrs.features, isModule);
    } catch (error) {
      return { result: "parser error", error };
    }

    const hash = crypto.createHash("sha1").update(contents).digest("hex");

    const cached = cache.get(hash);
    if (cached) return cached;

    let result;
    let ret;
    try {
      result = await Promise.race([
        agent.evalScript({
          attrs,
          contents,
          file: path.join(opts.testRoot, file),
        }),
        timeout(file),
      ]);
    } catch (error) {
      return { result: "timeout error", error };
    }

    if (result.error) {
      ret = { result: "runtime error", error: result.error };
    } else {
      ret = { result: "success", output: result.stdout };
    }

    cache.put(hash, ret);

    return ret;
  },
};
