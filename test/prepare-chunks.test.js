"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, test } = require("node:test");

const { FIXTURE_TEST262, ROOT, runScript, tmpDir } = require("./helpers");

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

function copyFixture(t) {
  const dir = tmpDir(t);
  fs.cpSync(FIXTURE_TEST262, dir, { recursive: true });
  return dir;
}

function writeTest(test262, file) {
  fs.mkdirSync(path.dirname(path.join(test262, file)), { recursive: true });
  fs.writeFileSync(
    path.join(test262, file),
    "/*---\ndescription: Passes\n---*/\nassert.sameValue(1, 1);\n"
  );
}

// Map { file => index of its chunk }
function chunkOfEachFile(chunks) {
  return new Map(chunks.flatMap((chunk, i) => chunk.map(file => [file, i])));
}

describe("prepare-chunks", () => {
  test("creates the requested number of chunks", () => {
    assert.equal(prepareChunks(3).length, 3);
  });

  test("lists every test file exactly once, across scenarios", () => {
    const files = prepareChunks(3).flat().sort();
    assert.deepEqual(files, ALL_FILES);
  });

  test("distributes files evenly", t => {
    // The fixture has too few files to tell anything about the hash.
    const test262 = copyFixture(t);
    for (let i = 0; i < 300; i++) {
      writeTest(test262, `test/language/generated/test-${i}.js`);
    }
    const sizes = prepareChunks(3, test262).map(chunk => chunk.length);
    const total = ALL_FILES.length + 300;
    assert.equal(sizes.reduce((a, b) => a + b), total);
    // Within 3 standard deviations of a uniform distribution (about 103 ± 25).
    const mean = total / 3;
    const deviation = Math.sqrt(total * (1 / 3) * (2 / 3));
    for (const size of sizes) {
      assert.ok(
        Math.abs(size - mean) < 3 * deviation,
        `unbalanced chunks: ${sizes}`
      );
    }
  });

  test("keeps a file in its chunk when other files are added or removed", t => {
    const before = chunkOfEachFile(prepareChunks(3));

    const test262 = copyFixture(t);
    fs.rmSync(path.join(test262, "test/language/fails.js"));
    fs.rmSync(path.join(test262, "test/language/no-strict.js"));
    for (let i = 0; i < 20; i++) {
      writeTest(test262, `test/language/added-${i}.js`);
    }
    const after = chunkOfEachFile(prepareChunks(3, test262));

    let kept = 0;
    for (const [file, chunk] of before) {
      if (!after.has(file)) continue;
      assert.equal(after.get(file), chunk, file);
      kept++;
    }
    assert.equal(kept, ALL_FILES.length - 2);
  });

  test("a single chunk has all the files", () => {
    const [chunk] = prepareChunks(1);
    assert.deepEqual([...chunk].sort(), ALL_FILES);
  });

  test("creates every chunk when there are more chunks than files", () => {
    const chunks = prepareChunks(ALL_FILES.length + 2);
    assert.equal(chunks.length, ALL_FILES.length + 2);
    assert.deepEqual(chunks.flat().sort(), ALL_FILES);
  });

  test("accepts an absolute TEST262_PATH, like run-tests does", () => {
    assert.deepEqual(prepareChunks(1, FIXTURE_TEST262).flat().sort(), ALL_FILES);
  });
});
