"use strict";

const path = require("path");
const { createHash } = require("crypto");
const Test262Stream = require("@babel/test262-stream");

const TESTS = process.env.TEST262_PATH
  ? path.resolve(process.cwd(), process.env.TEST262_PATH)
  : path.join(__dirname, "../../test262");

const COUNT = Number(process.argv[2]);

async function uniqueFromAsync(iterable, map) {
  const set = new Set();
  for await (const item of iterable) {
    set.add(map(item));
  }
  return Array.from(set);
}

async function main() {
  const testsStream = new Test262Stream(TESTS, {
    paths: ["test/language", "test/harness", "test/staging"],
  }).once("error", () => {
    process.exitCode = 1;
  });

  // The stream emits the files in the order it finishes reading them, which
  // changes from run to run: sort them so that the chunks are reproducible.
  const tests = (await uniqueFromAsync(testsStream, test => test.file)).sort();

  // Assign each test to a chunk based on a hash of its path:
  // - like a round-robin distribution, it spreads every directory over all
  //   the chunks, which matters because the cost of a test depends a lot on
  //   its directory;
  // - unlike it, a test stays in the same chunk when other tests are added or
  //   removed, so the per-chunk result caches keep working across test262
  //   updates and across branches pinned to different test262 commits.
  const chunks = Array.from({ length: COUNT }, () => []);
  for (const test of tests) {
    const hash = createHash("sha1").update(test).digest();
    chunks[hash.readUInt32BE(0) % COUNT].push(test);
  }

  console.log(JSON.stringify(chunks, null, 2));
}
main();
