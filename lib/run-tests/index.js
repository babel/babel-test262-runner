"use strict";

const path = require("path");
const Test262Stream = require("test262-stream");
const tap = require('make-tap-output')({ count: true });

const NODE = path.join(__dirname, "../../engine/node/bin/node");
const TESTS = path.join(__dirname, "../../test262");

const TEST_TIMEOUT = 60 * 1000; // 1 minute

const AgentPool = require("./agent-pool");
const transpile = require("./transpile");

// The output of this program is processed by tap-xunit
// Using console.log on stdout will break CI output
// Use tap.diag instead.
tap.pipe(process.stdout);

async function main() {
  const agents = new AgentPool(NODE);
  const tests = new Test262Stream(TESTS, {
    paths: ['test/language'],
  });

  const filter = process.argv[2];
  if (!filter) {
    throw new Error("If you really want to run all the tests, use\n\tnode lib/run-tests I_AM_SURE");
  }

  tap.diag(`Using ${agents.count} threads.`);

  let passed = 0;
  let finished = 0;
  let run = 0;
  let total = 0;

  for await (const test of tests) {
    total++;
    const file = `${test.file} ${test.scenario}`;

    if (filter !== "I_AM_SURE" && !test.file.includes(filter)) continue;

    run++;

    agents.withAgent(async agent => {
      const expected = getExpected(test);
      const actual = await runTest(agent, test);

      finished++;
      const progress = `- ${finished}/${run}`
      if (actual.result === expected) {
        passed++;
        tap.pass(
          file,
          `(${expected})`
        );
      } else {
        tap.fail(
          file,
          `(expected ${expected}, got ${actual.result})`,
          new RethrownError(actual.error)
        );
      }
    });
  }

  await agents.close();
  tap.diag("\n\n");
  tap.diag(`Run ${run} out of ${total} tests.`);
  tap.diag(`Passed ${passed} out of ${run} tests.`);
  // Creating promises based timeouts per test prevents node from exiting
  // causing an unparseable failure in CircleCI. Here we're forcing an exit
  // with an exit code 0. tap-mocha-reporter will parse the tap output
  // and output the correct exit code.
  process.exit(0);
}
main();

function getExpected({ attrs }) {
  if (attrs.negative) {
    const { phase } = attrs.negative;
    if (phase === "early" || phase === "parse") {
      return "parser error";
    } else {
      return "runtime error";
    }
  } else {
    return "success";
  }
}

async function runTest(agent, test) {
  let { attrs, contents, file } = test;
  const isModule = attrs.flags.module;

  try {
    contents = transpile(contents, attrs.features, isModule);
  } catch (error) {
    return { result: "parser error", error };
  }
  let result;
  try {
    result = await Promise.race([agent.evalScript({
      attrs,
      contents,
      file: path.join(TESTS, file),
    }), timeout(file)]);
  } catch (error) {
    return { result: "timeout error", error };
  }

  if (result.error) {
    return { result: "runtime error", error: result.error };
  } else {
    return { result: "success", output: result.stdout };
  }
}

function timeout(file, waitMs = TEST_TIMEOUT) {
  return new Promise(
    (_resolve, reject) => setTimeout(
        () => reject(new Error(`test ${file} timed out after ${waitMs} ms`)),
        waitMs,
      )
    );
}

class ExtendedError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name;
    this.message = message;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = (new Error(message)).stack;
    }
  }
}

class RethrownError extends ExtendedError {
  constructor(error) {
    const message = error.message;
    super(message);
    this.name = error.name;
    if (!error) throw new Error('RethrownError requires an error');
    this.original = error;
    this.new_stack = this.stack;
    const errorStackString = error.stack && (typeof error.stack === 'string' ?
      error.stack : error.stack.map(location => location.source).join('\n'));
    let message_lines = (this.message.match(/\n/g) || []).length + 1;
    this.stack = `${this.name}: ${this.message}\n${
      this.stack.split('\n').slice(0, message_lines + 1).join('\n')
      }\n${errorStackString}`;
  }
}
