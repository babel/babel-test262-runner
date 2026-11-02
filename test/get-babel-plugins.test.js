"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const getBabelPlugins = require("../lib/run-tests/get-babel-plugins");
const transformEval = require("../lib/run-tests/plugins/transform-eval");
const transformCodepoint = require("../lib/run-tests/plugins/transform-invalid-identifier-codepoint");

const DEFAULTS = [transformCodepoint, transformEval];

test("only returns the default plugins when there are no features", () => {
  assert.deepEqual(getBabelPlugins(), DEFAULTS);
  assert.deepEqual(getBabelPlugins([]), DEFAULTS);
});

test("ignores features that don't need a plugin", () => {
  assert.deepEqual(getBabelPlugins(["arrow-function", "class"]), DEFAULTS);
});

test("adds the decorators plugin, with the supported version", () => {
  const [decorators, ...rest] = getBabelPlugins(["decorators"]);
  assert.deepEqual(decorators[1], { version: "2023-11" });
  assert.deepEqual(rest, DEFAULTS);
});

test("leaves explicit resource management to preset-env", () => {
  assert.deepEqual(getBabelPlugins(["explicit-resource-management"]), DEFAULTS);
});

test("adds a plugin once, even when its feature is repeated", () => {
  const plugins = getBabelPlugins(["decorators", "decorators"]);
  assert.equal(plugins.length, DEFAULTS.length + 1);
});

test("does not expose Object.prototype keys as features", () => {
  assert.deepEqual(getBabelPlugins(["toString"]).slice(-2), DEFAULTS);
});
