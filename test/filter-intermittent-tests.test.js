"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const { ROOT } = require("./helpers");
const filterIntermittentTests = require("../lib/run-tests/filter-intermittent-tests");

const listed = fs
  .readFileSync(path.join(ROOT, "intermittent-tests.txt"), "utf8")
  .trim()
  .split("\n");

test("matches every test in intermittent-tests.txt", () => {
  assert.ok(listed.length > 0);
  for (const file of listed) {
    assert.equal(filterIntermittentTests(file), true, file);
  }
});

test("does not match other tests", () => {
  assert.equal(filterIntermittentTests("test/language/passes.js default"), false);
});

test("only matches a whole entry, including its scenario", () => {
  const [file, scenario] = listed[0].split(/ (.+)/);
  assert.ok(file.endsWith(".js") && scenario);

  assert.equal(filterIntermittentTests(file), false);
  assert.equal(filterIntermittentTests(`${file} other scenario`), false);
  assert.equal(filterIntermittentTests(listed[0].slice(1)), false);
});
