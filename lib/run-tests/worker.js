const path = require("path");
const crypto = require("crypto");
const lmdb = require("lmdb");

const dependencies = require("eshost/lib/dependencies");

const BabelAgent = require("./babel-agent");
const transpile = require("./transpile");

const TEST_TIMEOUT = 60 * 1000; // 1 minute

function sha1(str) {
  return crypto.createHash("sha1").update(str, "utf8").digest("hex");
}

function buildCacheHash(test) {
  let { phase = "", type = "" } = test.attrs.negative || {};
  if ((phase === "early" || phase === "parse") && type === "SyntaxError") {
    return sha1(test.contents);
  }
  const sources = dependencies
    .getDependencies(test.file)
    .sort()
    .map(function (file) {
      if (file === path.basename(test.file)) {
        return;
      }
      return dependencies.rawSource.get(path.basename(file));
    })
    .filter(Boolean);

  sources.push(test.contents);

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

let agent, testRoot, cacheDB;

exports.setup = function (opts) {
  agent = new BabelAgent(opts);
  testRoot = opts.testRoot;
  cacheDB = new lmdb.open("cache.lmdb", {
    compression: true,
  });
};

exports.runTest = async function (test) {
  let { attrs, contents, file } = test;
  const isModule = attrs.flags.module;

  const cacheKey = sha1(JSON.stringify({ attrs, file }));

  try {
    contents = transpile(contents, {
      features: attrs.features,
      isModule,
      isStrict: false,
    });
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
    return cacheData.ret;
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

  cacheDB?.put(cacheKey, { hash: cacheHash, ret });

  return ret;
};
