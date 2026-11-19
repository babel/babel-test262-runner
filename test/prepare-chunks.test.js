"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, test } = require("node:test");

const { FIXTURE_TEST262, ROOT, runScript } = require("./helpers");

const SCRIPT = path.join(ROOT, "lib/prepare-chunks");

const ALL_FILES = [
  "test/harness/passes.js",
  "test/language/fails.js",
  "test/language/negative-parse-missed.js",
  "test/language/negative-parse.js",
  "test/language/negative-runtime-missed.js",
  "test/language/negative-runtime.js",
  "test/language/no-strict.js",
  "test/language/only-strict.js",
  "test/language/passes.js",
  "test/staging/passes.js",
];

function prepareChunks(count, test262 = path.relative(ROOT, FIXTURE_TEST262)) {
  const { status, stdout } = runScript(SCRIPT, [String(count)], {
    env: { TEST262_PATH: test262 },
  });
  assert.equal(status, 0);
  return JSON.parse(stdout);
}

describe("prepare-chunks", () => {
  test("creates the requested number of chunks", () => {
    assert.equal(prepareChunks(3).length, 3);
  });

  test("lists every test file exactly once, across scenarios", () => {
    const files = prepareChunks(3).flat().sort();
    assert.deepEqual(files, ALL_FILES);
  });

  test("distributes files evenly", () => {
    const sizes = prepareChunks(3).map(chunk => chunk.length);
    assert.deepEqual(sizes, [4, 3, 3]);
  });

  test("a single chunk has all the files", () => {
    const [chunk] = prepareChunks(1);
    assert.deepEqual([...chunk].sort(), ALL_FILES);
  });

  test("leaves chunks empty when there are more chunks than files", () => {
    const chunks = prepareChunks(ALL_FILES.length + 2);
    assert.equal(chunks.flat().length, ALL_FILES.length);
    assert.deepEqual(chunks.slice(-2), [[], []]);
  });

  test("accepts an absolute TEST262_PATH, like run-tests does", () => {
    assert.deepEqual(prepareChunks(1, FIXTURE_TEST262).flat().sort(), ALL_FILES);
  });
});
