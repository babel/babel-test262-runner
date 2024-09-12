const path = require("path");
const fs = require("fs");
const crypto = require('crypto');
const lmdb = require("lmdb");
const strip = require('strip-comments');

const BabelAgent = require("./babel-agent");
const transpile = require("./transpile");

const TEST_TIMEOUT = 60 * 1000; // 1 minute

function sha1(str) {
  return crypto.createHash('sha1').update(str, 'utf8').digest('hex');
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
  const fileContents = strip(fs.readFileSync(path.join(testRoot, file), "utf8"));
  const allowCache = ["eval(", "require(", "import", "evalScript("].every((keyword) => !fileContents.includes(keyword));
  
  try {
    contents = transpile(contents, { features: attrs.features, isModule, isStrict: false });
  } catch (error) {
    return { result: "parser error", error };
  }

  const hash = sha1(contents);

  const cacheData = allowCache ? cacheDB.get(cacheKey) : null;
  if (cacheData?.hash === hash) {
    return cacheData.ret;
  }

  let result;
  let ret;
  try {
    result = await Promise.race([
      agent.evalScript({
        attrs,
        contents,
        file: path.join(testRoot, file),
      }),
      timeout(file),
    ]);

    if (result.error) {
      ret = { result: "runtime error", error: result.error };
    } else {
      ret = { result: "success", output: result.stdout };
    }
  } catch (error) {
    agent.stop(); // kill process avoid 100% cpu usage

    ret = { result: "timeout error", error };
  }

  if (allowCache) {
    cacheDB.put(cacheKey, { hash, ret });
  }

  return ret;
};
