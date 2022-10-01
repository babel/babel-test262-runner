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
    paths: ["test/language"],
  }).once("error", () => {
    process.exitCode = 1;
  });

  const tests = await uniqueFromAsync(testsStream, test => test.file);

  const chunkSize = Math.ceil(tests.length / COUNT);

  const chunks = [];
  for (let i = 0; i < COUNT; i++) {
    chunks.push(tests.slice(i * chunkSize, (i + 1) * chunkSize));
  }

  console.log(JSON.stringify(chunks, null, 2));
}
main();
