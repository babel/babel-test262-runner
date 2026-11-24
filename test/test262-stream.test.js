"use strict";

// Checks the fix for the exponential copyright regex, which @babel/test262-stream
// has since 2.0.0.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, test } = require("node:test");
const Test262Stream = require("@babel/test262-stream");

const { FIXTURE_TEST262, ROOT, runScript, tmpDir } = require("./helpers");

function createTest262(t, contents) {
  const dir = tmpDir(t);
  fs.cpSync(path.join(FIXTURE_TEST262, "harness"), path.join(dir, "harness"), {
    recursive: true,
  });
  // prepare-chunks reads these three directories
  for (const name of ["language", "harness", "staging"]) {
    fs.mkdirSync(path.join(dir, "test", name), { recursive: true });
  }
  fs.writeFileSync(path.join(dir, "test/language/test.js"), contents);
  return dir;
}

async function readCopyright(test262) {
  for await (const test of new Test262Stream(test262, {
    paths: ["test/language"],
  })) {
    return test.copyright;
  }
}

const FRONTMATTER = `/*---
description: Passes
---*/
`;

describe("test262-stream", () => {
  test("reads a line made of many slashes in linear time", t => {
    // test/staging/sm/misc/function-definition-eval.js has a 51-character line
    // of slashes, which took about 20s to read with the original regex.
    const test262 = createTest262(
      t,
      `${"/".repeat(64)}\n// Comment\n${"/".repeat(64)}\n${FRONTMATTER}`
    );
    const { status, signal, stdout } = spawnPrepareChunks(test262);
    assert.equal(signal, null, "prepare-chunks timed out");
    assert.equal(status, 0);
    assert.deepEqual(JSON.parse(stdout), [["test/language/test.js"]]);
  });

  test("extracts the copyright line", async t => {
    const test262 = createTest262(
      t,
      `// Copyright (C) 2024 Someone. All rights reserved.\n// This code is governed by the BSD license.\n${FRONTMATTER}`
    );
    assert.equal(
      await readCopyright(test262),
      "// Copyright (C) 2024 Someone. All rights reserved."
    );
  });

  test("extracts a copyright line after other comments", async t => {
    const test262 = createTest262(
      t,
      `#!/usr/bin/env node\n// http://example.com // Copyright Someone\n${FRONTMATTER}`
    );
    assert.equal(
      await readCopyright(test262),
      "// http://example.com // Copyright Someone"
    );
  });

  test("ignores tests without copyright", async t => {
    const test262 = createTest262(t, `// No license\n${FRONTMATTER}`);
    assert.equal(await readCopyright(test262), "");
  });
});

function spawnPrepareChunks(test262) {
  return runScript(path.join(ROOT, "lib/prepare-chunks"), ["1"], {
    env: { TEST262_PATH: test262 },
    timeout: 10_000,
  });
}
