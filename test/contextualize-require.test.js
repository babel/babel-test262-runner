"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const { tmpDir, withEnv } = require("./helpers");

const MODULE = require.resolve("../lib/run-tests/contextualize-require");

// BABEL_PATH is read when the module is loaded
function load(babelPath) {
  delete require.cache[MODULE];
  return withEnv("BABEL_PATH", babelPath, () => require(MODULE));
}

function createBabelClone(t) {
  const dir = tmpDir(t);
  const pkg = path.join(dir, "packages/babel-core");
  fs.mkdirSync(pkg, { recursive: true });
  fs.writeFileSync(path.join(pkg, "index.js"), `module.exports = "local";`);
  return dir;
}

test("without BABEL_PATH, uses the installed package", () => {
  const requireBabel = load(undefined);
  assert.equal(requireBabel("@babel/core"), require("@babel/core"));
});

test("with BABEL_PATH, maps @babel/* to the packages of the clone", t => {
  const requireBabel = load(createBabelClone(t));
  assert.equal(requireBabel("@babel/core"), "local");
});

test("resolves a relative BABEL_PATH from the current directory", t => {
  const clone = createBabelClone(t);
  const requireBabel = load(path.relative(process.cwd(), clone));
  assert.equal(requireBabel("@babel/core"), "local");
});

test("falls back to the installed package, and fails the process", t => {
  const log = t.mock.method(console, "error", () => {});
  const { exitCode } = process;
  t.after(() => {
    process.exitCode = exitCode;
  });

  const requireBabel = load(tmpDir(t));
  assert.equal(requireBabel("@babel/core"), require("@babel/core"));

  assert.equal(process.exitCode, 1);
  assert.equal(log.mock.callCount(), 1);
  assert.match(log.mock.calls[0].arguments[0], /packages\/babel-core .*failed/);
});
