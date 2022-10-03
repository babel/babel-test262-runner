const path = require("path");

const BabelAgent = require("./babel-agent");
const transpile = require("./transpile");

const TEST_TIMEOUT = 60 * 1000; // 1 minute

function timeout(file, waitMs = TEST_TIMEOUT) {
  return new Promise((_resolve, reject) =>
    setTimeout(
      () => reject(new Error(`test ${file} timed out after ${waitMs} ms`)),
      waitMs
    )
  );
}

let agent, testRoot;

exports.setup = function (opts) {
  agent = new BabelAgent(opts);
  testRoot = opts.testRoot;
};

exports.runTest = async function (test) {
  let { attrs, contents, file } = test;
  const isModule = attrs.flags.module;

  try {
    contents = transpile(contents, attrs.features, isModule);
  } catch (error) {
    return { result: "parser error", error };
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
  } catch (error) {
    agent.stop(); // kill process avoid 100% cpu usage

    return { result: "timeout error", error };
  }

  if (result.error) {
    ret = { result: "runtime error", error: result.error };
  } else {
    ret = { result: "success", output: result.stdout };
  }

  return ret;
};
