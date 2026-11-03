"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, test } = require("node:test");
const { setTimeout: sleep } = require("node:timers/promises");

const { createFakeEngine, tmpDir } = require("./helpers");
const BabelAgent = require("../lib/run-tests/babel-agent");

const CORE_JS = require.resolve("core-js-bundle");

describe("BabelAgent", () => {
  const agent = new BabelAgent({ hostPath: process.execPath });

  test("defaults the host's short name to $262", () => {
    assert.equal(agent.shortName, "$262");
  });

  test("the runtime has its polyfills filled in", () => {
    assert.doesNotMatch(BabelAgent.runtime, /\$POLYFILLS/);
    assert.ok(BabelAgent.runtime.includes(CORE_JS));
  });

  describe("evalScript", () => {
    function createAgent(t, engineBody) {
      const engine = createFakeEngine(path.join(tmpDir(t), "engine"), engineBody);
      return { engine, agent: new BabelAgent({ hostPath: engine.path }) };
    }

    test("reports an engine that exits with an error", async t => {
      const { agent } = createAgent(t, "exit 3");
      const { error } = await agent.evalScript("1;");

      assert.equal(error.name, "EngineError");
      assert.match(error.message, /^The engine exited with code 3/);
    });

    test("does not report an engine that it stopped itself", async t => {
      const { agent, engine } = createAgent(t, "exec sleep 60");
      const running = agent.evalScript("1;");

      while (engine.pids().length === 0) await sleep(10);
      await agent.stop();

      assert.equal((await running).error, null);
    });
  });

  describe("compile", () => {
    const code = agent.compile("var testBody = 1;");

    test("includes the test", () => {
      assert.ok(code.includes("testBody"));
    });

    test("loads the polyfills before running the test", () => {
      const polyfills = code.indexOf("core-js-bundle");
      assert.notEqual(polyfills, -1);
      assert.ok(polyfills < code.lastIndexOf("runInESHostContext("));
    });

    test("exposes `exports` to the test's context", () => {
      assert.match(code, /createContext\(\{exports:exports,/);
    });

    test("compiles the eshost wrapper, for engines without ES2015", () => {
      assert.doesNotMatch(code, /print\(\.\.\.args\)|console\.log\(\.\.\.args\)/);
    });

    test("uses the configured short name in the wrapped test", () => {
      assert.ok(code.includes("$262.destroy()"));
    });
  });
});
