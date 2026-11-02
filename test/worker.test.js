"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, test } = require("node:test");
const { setTimeout: sleep } = require("node:timers/promises");

const { FIXTURE_TEST262, createFakeEngine, tmpDir } = require("./helpers");

const TEST_TIMEOUT = 60 * 1000;

// The worker opens the real cache by its hard-coded path: use an in-memory one.
let store;
require.cache[require.resolve("lmdb")] = {
  exports: {
    open: function () {
      return {
        get: key => store.get(key),
        put: (key, value) => void store.set(key, value),
      };
    },
  },
  loaded: true,
};

const worker = require("../lib/run-tests/worker");

function setup(t, engineBody) {
  store = new Map();
  const engine = createFakeEngine(path.join(tmpDir(t), "engine"), engineBody);
  engine.timeouts = trapTestTimeouts(t);
  worker.setup({
    hostPath: engine.path,
    shortName: "$262",
    testRoot: FIXTURE_TEST262,
  });
  return engine;
}

// The worker never clears the timeout of a test, which would keep this process
// alive for a minute. Hold on to it instead, so that tests can also trigger it.
function trapTestTimeouts(t) {
  const timeouts = [];
  const { setTimeout } = globalThis;
  t.mock.method(globalThis, "setTimeout", (fn, ms, ...args) => {
    if (ms !== TEST_TIMEOUT) return setTimeout(fn, ms, ...args);
    timeouts.push(fn);
  });
  return timeouts;
}

function makeTest(contents, attrs) {
  return {
    file: "test/language/passes.js",
    contents,
    attrs: { description: "A test", flags: {}, features: [], ...attrs },
  };
}

describe("runTest", () => {
  test("reports success and the output of the test", async t => {
    const engine = setup(t);
    const ret = await worker.runTest(makeTest(`print("hello");`));

    assert.equal(ret.result, "success");
    assert.equal(ret.output, "hello\n");
    assert.equal(engine.pids().length, 1);
  });

  test("reports errors thrown when running the test", async t => {
    setup(t);
    const ret = await worker.runTest(makeTest(`throw new TypeError("boom");`));

    assert.equal(ret.result, "runtime error");
    assert.equal(ret.error.name, "TypeError");
    assert.equal(ret.error.message, "boom");
  });

  test("reports errors from Babel without starting the engine", async t => {
    const engine = setup(t);
    const ret = await worker.runTest(makeTest("let let;"));

    assert.equal(ret.result, "parser error");
    assert.equal(ret.error.code, "BABEL_PARSE_ERROR");
    assert.equal(engine.pids().length, 0);
    assert.equal(store.size, 0);
  });

  test("passes the features of the test to Babel", async t => {
    setup(t);
    const source = "function dec() {} @dec class A {}";

    const without = await worker.runTest(makeTest(source));
    const enabled = await worker.runTest(
      makeTest(source, { features: ["decorators"] })
    );

    assert.equal(without.result, "parser error");
    assert.equal(enabled.result, "success");
  });

  test("compiles tests with the module flag as modules", async t => {
    setup(t);
    const ret = await worker.runTest(
      makeTest("export var a = 1;", { flags: { module: true } })
    );

    assert.equal(ret.result, "success");
  });

  describe("cache", () => {
    test("reuses the result of an unchanged test", async t => {
      const engine = setup(t);
      const first = await worker.runTest(makeTest(`print("hello");`));
      const second = await worker.runTest(makeTest(`print("hello");`));

      assert.equal(engine.pids().length, 1);
      assert.equal(second.result, first.result);
      assert.equal(second.output, first.output);
    });

    test("reruns a test when its compiled output changes", async t => {
      t.mock.method(console, "log", () => {});
      const engine = setup(t);
      await worker.runTest(makeTest(`print("a");`));
      const ret = await worker.runTest(makeTest(`print("b");`));

      assert.equal(engine.pids().length, 2);
      assert.equal(ret.output, "b\n");
      assert.equal(store.size, 1);
    });

    test("keeps the results of different scenarios apart", async t => {
      const engine = setup(t);
      await worker.runTest(makeTest("1;"));
      await worker.runTest(
        makeTest(`"use strict";\n1;`, {
          description: "A test (Strict Mode)",
        })
      );

      assert.equal(engine.pids().length, 2);
      assert.equal(store.size, 2);
    });

    test("keeps the results of different files apart", async t => {
      const engine = setup(t);
      await worker.runTest(makeTest("1;"));
      await worker.runTest({
        ...makeTest("1;"),
        file: "test/language/fails.js",
      });

      assert.equal(engine.pids().length, 2);
    });
  });

  describe("timeout", () => {
    test("kills the engine and reports the timeout", async t => {
      const engine = setup(t);
      const running = worker.runTest(makeTest("while (true) {}"));

      while (engine.pids().length === 0 || engine.timeouts.length === 0) {
        await sleep(10);
      }
      const [pid] = engine.pids();
      assert.doesNotThrow(() => process.kill(pid, 0));
      // Don't leave a process spinning if the worker failed to kill it.
      t.after(() => {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
      });

      engine.timeouts[0]();
      const ret = await running;

      assert.equal(ret.result, "timeout error");
      assert.match(ret.error.message, /passes\.js timed out after 60000 ms/);

      await waitForExit(pid);
    });
  });

  describe("engine failures", () => {
    test(
      "does not report an engine that fails to run the test as a success",
      {
        todo: "eshost ignores the exit code: anything it can't parse as an error is a success",
      },
      async t => {
        setup(t, `echo "FATAL ERROR: out of memory" >&2\nexit 1`);
        const ret = await worker.runTest(makeTest("1;"));

        assert.notEqual(ret.result, "success");
      }
    );
  });
});

async function waitForExit(pid) {
  for (let i = 0; i < 500; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await sleep(10);
  }
  assert.fail(`process ${pid} is still running`);
}
