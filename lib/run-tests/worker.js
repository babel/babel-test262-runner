const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const lmdb = require("lmdb");

const dependencies = require("eshost/lib/dependencies");

const BabelAgent = require("./babel-agent");
const { transpileTest } = require("./transpile");

const TEST_TIMEOUT = 60 * 1000; // 1 minute

function sha1(str) {
  return crypto.createHash("sha1").update(str, "utf8").digest("hex");
}

const coreJSVersion = require("core-js-bundle").version;

function buildCacheHash(test) {
  let { phase = "", type = "" } = test.attrs.negative || {};
  if ((phase === "early" || phase === "parse") && type === "SyntaxError") {
    return sha1(`${runtimeHash}\n${test.contents}`);
  }
  const sources = dependencies
    .getDependencies(test.file)
    .sort()
    .map(function (file) {
      if (file === path.basename(test.file)) {
        return;
      }
      // `dependencies.rawSource` is keyed by basename: fixtures sharing a name
      // across directories would make the hash depend on the test order.
      try {
        return fs.readFileSync(path.join(path.dirname(test.file), file), "utf8");
      } catch {
        return;
      }
    })
    .filter(Boolean);

  sources.push(test.contents);
  sources.push(coreJSVersion);
  sources.push(runtimeHash);

  return sha1(sources.join("\n"));
}

function timeout(file, waitMs = TEST_TIMEOUT) {
  return new Promise((_resolve, reject) =>
    setTimeout(
      () => reject(new Error(`test ${file} timed out after ${waitMs} ms`)),
      waitMs
    )
  );
}

let agent, testRoot, cacheDB, runtimeHash;

exports.setup = function (opts) {
  agent = new BabelAgent(opts);
  testRoot = opts.testRoot;
  // The eshost runtime wrapping every test is compiled by the Babel version
  // under test too, so a change in its output must invalidate the cache.
  runtimeHash = sha1(agent.compile(""));
  cacheDB = new lmdb.open(path.join(__dirname, "../../cache.lmdb"), {
    compression: true,
  });
};

exports.runTest = async function (test) {
  let { attrs, contents, file } = test;

  const cacheKey = sha1(JSON.stringify({ attrs, file }));

  try {
    contents = transpileTest(test);
  } catch (error) {
    return { result: "parser error", error };
  }

  const testObject = {
    attrs,
    contents,
    file: path.join(testRoot, file),
  };

  const cacheHash = buildCacheHash(testObject);

  const cacheData = cacheDB?.get(cacheKey);
  if (cacheData?.hash === cacheHash) {
    return { ...cacheData.ret, cache: "hit" };
  }

  let result;
  let ret;
  try {
    result = await Promise.race([agent.evalScript(testObject), timeout(file)]);

    if (result.error) {
      ret = { result: "runtime error", error: result.error };
    } else {
      ret = { result: "success", output: result.stdout };
    }
  } catch (error) {
    agent.stop(); // kill process avoid 100% cpu usage

    ret = { result: "timeout error", error };
  }

  // Timeouts and engine failures can depend on the machine rather than on the
  // test, so they are not cached. V8 running out of heap is the exception.
  if (
    ret.result !== "timeout error" &&
    (ret.error?.name !== "EngineError" || isHeapOutOfMemory(ret.error))
  ) {
    cacheDB?.put(cacheKey, { hash: cacheHash, ret });
  }

  return { ...ret, cache: cacheData ? "stale" : "miss" };
};

// V8 aborts when the heap reaches its limit, which for Node.js 0.10 is a fixed
// default rather than a share of the machine's memory: the same test always
// aborts, after filling the heap for up to half a minute. When the machine
// itself runs out of memory, the OS kills the engine with SIGKILL instead.
function isHeapOutOfMemory(error) {
  return /^The engine was killed by SIGABRT: (?:[^]*\n)?FATAL ERROR: .*Allocation failed - (?:process|JavaScript heap) out of memory/.test(
    error.message
  );
}
