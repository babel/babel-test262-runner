"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FIXTURE_TEST262 = path.join(__dirname, "fixtures/test262");

function tmpDir(t) {
  // os.tmpdir() can be a symlink, which breaks paths relative to process.cwd()
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "babel-test262-runner-"))
  );
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Node.js 0.10 is not available on every platform, so the tests replace it with
// the current Node.js. This checks the runner's own logic, not whether Babel's
// output runs correctly on Node.js 0.10.
// `body` runs before the engine starts, and every spawn is logged with its pid.
function createFakeEngine(file, body = `exec "${process.execPath}" "$@"`) {
  const log = `${file}.log`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(log, "");
  // Node.js 0.10 never colors errors. With FORCE_COLOR the current Node.js would,
  // and eshost could not parse them anymore.
  fs.writeFileSync(
    file,
    `#!/bin/sh\necho $$ >> "${log}"\nunset FORCE_COLOR\n${body}\n`,
    { mode: 0o755 }
  );
  return {
    path: file,
    pids: () => fs.readFileSync(log, "utf8").split("\n").filter(Boolean),
  };
}

// lib/run-tests hard-codes the paths of the engine and of the LMDB cache
// relatively to itself: run a copy, to not touch the real ones.
function createRunner(t) {
  const dir = tmpDir(t);
  fs.cpSync(path.join(ROOT, "lib"), path.join(dir, "lib"), { recursive: true });
  fs.copyFileSync(
    path.join(ROOT, "intermittent-tests.txt"),
    path.join(dir, "intermittent-tests.txt")
  );
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(dir, "node_modules"));
  return {
    dir,
    engine: createFakeEngine(path.join(dir, "engine/node/bin/node")),
    run(args, { env } = {}) {
      return runScript(path.join(dir, "lib/run-tests"), args, {
        cwd: dir,
        env: { TEST262_PATH: FIXTURE_TEST262, THREADS: "2", ...env },
      });
    },
  };
}

function runScript(script, args = [], { cwd = ROOT, env } = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

// { "test/language/passes.js default": { ok: true, detail: "success" }, ... }
function parseTap(output) {
  const results = {};
  for (const line of output.split("\n")) {
    const match = /^(not )?ok \d+ (.+?) # \((.*)\)$/.exec(line);
    if (match) results[match[2]] = { ok: !match[1], detail: match[3] };
  }
  return results;
}

// Runs fn with process.env[name] set to value (or deleted, if undefined).
function withEnv(name, value, fn) {
  const original = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return fn();
  } finally {
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
}

module.exports = {
  FIXTURE_TEST262,
  ROOT,
  createFakeEngine,
  createRunner,
  parseTap,
  runScript,
  tmpDir,
  withEnv,
};
