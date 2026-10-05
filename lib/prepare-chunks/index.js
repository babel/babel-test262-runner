"use strict";

const path = require("path");
const Test262Stream = require("test262-stream");

const TESTS = process.env.TEST262_PATH
  ? path.join(process.cwd(), process.env.TEST262_PATH)
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

  const tests = await uniqueFromAsync(testsStream, test => test.file);

  // Distribute the tests round-robin rather than in contiguous slices: the
  // cost of a test depends a lot on its directory, so contiguous slices of
  // the directory walk make some chunks much slower than others.
  const chunks = Array.from({ length: COUNT }, () => []);
  tests.forEach((test, i) => {
    chunks[i % COUNT].push(test);
  });

  console.log(JSON.stringify(chunks, null, 2));
}
main();
