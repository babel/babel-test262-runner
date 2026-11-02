"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, before, describe, test } = require("node:test");

const {
  FIXTURE_TEST262,
  createRunner,
  parseTap,
  tmpDir,
} = require("./helpers");

const both = name => [`${name} default`, `${name} strict mode`];

const ALL_TESTS = [
  ...both("test/language/passes.js"),
  ...both("test/language/fails.js"),
  "test/language/only-strict.js strict mode",
  "test/language/no-strict.js default",
  ...both("test/language/negative-parse.js"),
  ...both("test/language/negative-parse-missed.js"),
  ...both("test/language/negative-runtime.js"),
  ...both("test/language/negative-runtime-missed.js"),
  ...both("test/harness/passes.js"),
  ...both("test/staging/passes.js"),
];

function writeChunks(t, chunks) {
  const file = path.join(tmpDir(t), "chunks.json");
  fs.writeFileSync(file, JSON.stringify(chunks));
  return file;
}

describe("a full run", () => {
  const runner = createRunner({ after });
  let results, stdout, status;

  before(() => {
    ({ stdout, status } = runner.run(["I_AM_SURE"]));
    results = parseTap(stdout);
  });

  test("exits successfully, even if tests fail", () => {
    assert.equal(status, 0);
  });

  test("outputs TAP", () => {
    assert.match(stdout, /^TAP version 13\n/);
    assert.match(stdout, /^# Using 2 threads\.$/m);
  });

  test("runs each test in the scenarios it supports, and no others", () => {
    assert.deepEqual(Object.keys(results).sort(), [...ALL_TESTS].sort());
  });

  test("runs the strict scenario in strict mode, and default in sloppy", () => {
    const only = results["test/language/only-strict.js strict mode"];
    const no = results["test/language/no-strict.js default"];
    assert.deepEqual(only, { ok: true, detail: "success" });
    assert.deepEqual(no, { ok: true, detail: "success" });
  });

  test("passes a test that succeeds as expected", () => {
    assert.deepEqual(results["test/language/passes.js default"], {
      ok: true,
      detail: "success",
    });
  });

  test("fails a test that throws", () => {
    assert.deepEqual(results["test/language/fails.js default"], {
      ok: false,
      detail: "expected success, got runtime error",
    });
  });

  test("includes the original error of a failed test", () => {
    assert.match(stdout, /Expected 2 but got 1/);
  });

  test("expects a parser error from negative parse tests", () => {
    assert.deepEqual(results["test/language/negative-parse.js default"], {
      ok: true,
      detail: "parser error",
    });
    assert.deepEqual(results["test/language/negative-parse-missed.js default"], {
      ok: false,
      detail: "expected parser error, got success",
    });
  });

  test("expects a runtime error from negative runtime tests", () => {
    assert.deepEqual(results["test/language/negative-runtime.js default"], {
      ok: true,
      detail: "runtime error",
    });
    assert.deepEqual(results["test/language/negative-runtime-missed.js default"], {
      ok: false,
      detail: "expected runtime error, got success",
    });
  });

  test("reports totals", () => {
    const passed = Object.values(results).filter(r => r.ok).length;
    assert.equal(passed, 12);
    assert.match(stdout, /^# Run 18 out of 18 tests\.$/m);
    assert.match(stdout, /^# Passed 12 out of 18 tests\.$/m);
  });
});

describe("selecting tests", () => {
  test("fails without a filter", t => {
    const { status, stderr, stdout } = createRunner(t).run([]);

    assert.equal(status, 1);
    assert.match(stderr, /node lib\/run-tests I_AM_SURE/);
    assert.deepEqual(parseTap(stdout), {});
  });

  test("only runs tests whose path contains the filter", t => {
    const { stdout } = createRunner(t).run(["staging/"]);

    assert.deepEqual(
      Object.keys(parseTap(stdout)).sort(),
      both("test/staging/passes.js")
    );
    assert.match(stdout, /^# Run 2 out of 18 tests\.$/m);
  });

  test("skips the tests in intermittent-tests.txt", t => {
    const runner = createRunner(t);
    fs.appendFileSync(
      path.join(runner.dir, "intermittent-tests.txt"),
      "test/language/passes.js default\ntest/language/fails.js strict mode\n"
    );
    const results = parseTap(runner.run(["I_AM_SURE"]).stdout);

    assert.equal(results["test/language/passes.js default"], undefined);
    assert.equal(results["test/language/fails.js strict mode"], undefined);
    assert.equal(Object.keys(results).length, ALL_TESTS.length - 2);
    assert.ok(results["test/language/passes.js strict mode"]);
  });

  test("only runs the tests of the current chunk", t => {
    const chunks = writeChunks(t, [
      ["test/harness/passes.js"],
      ["test/staging/passes.js"],
    ]);
    const { stdout } = createRunner(t).run(["I_AM_SURE"], {
      env: { CHUNKS_FILE: chunks, CHUNK: "1" },
    });

    assert.deepEqual(
      Object.keys(parseTap(stdout)).sort(),
      both("test/staging/passes.js")
    );
  });

  test("resolves TEST262_PATH from the current directory", t => {
    const runner = createRunner(t);
    const { stdout } = runner.run(["staging/"], {
      env: { TEST262_PATH: path.relative(runner.dir, FIXTURE_TEST262) },
    });

    assert.equal(Object.keys(parseTap(stdout)).length, 2);
  });
});

describe("the cache", () => {
  test("a second run reuses results, and reports the same ones", t => {
    const runner = createRunner(t);

    const first = parseTap(runner.run(["I_AM_SURE"]).stdout);
    const firstRuns = runner.engine.pids().length;
    assert.ok(firstRuns > 0);

    const second = parseTap(runner.run(["I_AM_SURE"]).stdout);
    const secondRuns = runner.engine.pids().length - firstRuns;

    assert.deepEqual(second, first);
    assert.ok(
      secondRuns < firstRuns,
      `expected fewer than ${firstRuns} engine runs, got ${secondRuns}`
    );
  });
});
