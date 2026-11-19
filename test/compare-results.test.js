"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, test } = require("node:test");

const { ROOT, runScript, tmpDir } = require("./helpers");

const SCRIPT = path.join(ROOT, "lib/compare-results");

const pass = (id, name) => `ok ${id} ${name} # (success)`;
const fail = (id, name, detail = "expected success, got runtime error") =>
  `not ok ${id} ${name} # (${detail})
  ---
  name: Test262Error
  message: 'it failed'
  ...`;

function tap(...lines) {
  return `TAP version 13\n${lines.join("\n")}\n`;
}

function compare(t, main, pr) {
  const dir = tmpDir(t);
  const mainFile = path.join(dir, "main.tap");
  const prFile = path.join(dir, "pr.tap");
  fs.writeFileSync(mainFile, main);
  fs.writeFileSync(prFile, pr);
  return runScript(SCRIPT, [mainFile, prFile]);
}

describe("compare-results", () => {
  test("succeeds when nothing changed", t => {
    const results = tap(pass(1, "a.js default"), fail(2, "b.js default"));
    const { status, stdout } = compare(t, results, results);

    assert.equal(status, 0);
    assert.match(stdout, /^# 0 new failures, 0 new successes$/m);
    assert.match(stdout, /^1\.\.0$/m);
  });

  test("fails on new failures, and prints them", t => {
    const { status, stdout } = compare(
      t,
      tap(pass(1, "a.js default"), pass(2, "b.js default")),
      tap(pass(1, "a.js default"), fail(2, "b.js default"))
    );

    assert.equal(status, 1);
    assert.match(stdout, /^# 1 new failures, 0 new successes$/m);
    assert.match(stdout, /^not ok 2 b\.js default/m);
    assert.doesNotMatch(stdout, /^(not )?ok 1 /m);
    assert.match(stdout, /^1\.\.1$/m);
  });

  test("succeeds on new successes, and prints them", t => {
    const { status, stdout } = compare(
      t,
      tap(fail(1, "a.js default")),
      tap(pass(1, "a.js default"))
    );

    assert.equal(status, 0);
    assert.match(stdout, /^# 0 new failures, 1 new successes$/m);
    assert.match(stdout, /^ok 1 a\.js default/m);
  });

  test("reports both new failures and new successes", t => {
    const { status, stdout } = compare(
      t,
      tap(pass(1, "a.js default"), fail(2, "b.js default")),
      tap(fail(1, "a.js default"), pass(2, "b.js default"))
    );

    assert.equal(status, 1);
    assert.match(stdout, /^# 1 new failures, 1 new successes$/m);
    assert.match(stdout, /^1\.\.2$/m);
  });

  test("matches tests by name, not by their number", t => {
    const { status, stdout } = compare(
      t,
      tap(pass(1, "a.js default"), fail(2, "b.js default")),
      tap(fail(1, "b.js default"), pass(2, "a.js default"))
    );

    assert.equal(status, 0);
    assert.match(stdout, /^# 0 new failures, 0 new successes$/m);
  });

  test("treats the scenarios of a test as different tests", t => {
    const { status, stdout } = compare(
      t,
      tap(pass(1, "a.js default"), pass(2, "a.js strict mode")),
      tap(pass(1, "a.js default"), fail(2, "a.js strict mode"))
    );

    assert.equal(status, 1);
    assert.match(stdout, /^not ok 2 a\.js strict mode/m);
  });

  test("a failure with a different reason is not a change", t => {
    const { status, stdout } = compare(
      t,
      tap(fail(1, "a.js default", "expected success, got runtime error")),
      tap(fail(1, "a.js default", "expected success, got parser error"))
    );

    assert.equal(status, 0);
    assert.match(stdout, /^# 0 new failures, 0 new successes$/m);
  });

  test("ignores tests that are not in the main branch results", t => {
    const { status, stdout } = compare(
      t,
      tap(pass(1, "a.js default")),
      tap(pass(1, "a.js default"), fail(2, "new.js default"))
    );

    assert.equal(status, 0);
    assert.match(stdout, /Ignoring test 'new\.js default'/);
    assert.match(stdout, /^# 0 new failures, 0 new successes$/m);
  });

  test("warns, but does not fail, when a test is missing from the PR", t => {
    const { status, stdout } = compare(
      t,
      tap(pass(1, "a.js default"), pass(2, "b.js default")),
      tap(pass(1, "a.js default"))
    );

    assert.equal(status, 0);
    assert.match(stdout, /artifacts are out of sync/);
  });

  test("counts the successes in the PR results", t => {
    const { stdout } = compare(
      t,
      tap(pass(1, "a.js default"), pass(2, "b.js default"), fail(3, "c.js default")),
      tap(pass(1, "a.js default"), pass(2, "b.js default"), fail(3, "c.js default"))
    );

    assert.match(stdout, /, 2 successes$/m);
  });

  test("requires both artifacts", () => {
    const { status, stderr } = runScript(SCRIPT, ["main.tap"]);

    assert.notEqual(status, 0);
    assert.match(stderr, /artifact file paths required/);
  });
});
