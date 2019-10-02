"use strict";

const path = require("path");
const Test262Stream = require("test262-stream");
const chalk = require("chalk");
const tap = require('make-tap-output')({ count: true });

const NODE = path.join(__dirname, "../../engine/node/bin/node");
const TESTS = path.join(__dirname, "../../test262");

const TEST_TIMEOUT = 60 * 1000; // 1 minute

const AgentPool = require("./agent-pool");
const transpile = require("./transpile");

// The output of this program is processed by tap-xunit
// Using console.log on stdout will break CI output
// Use tap.diag instead.
tap.pipe(process.stdout)

async function main() {
  const agents = new AgentPool(NODE);
  const tests = new Test262Stream(TESTS);

  const filter = process.argv[2];
  if (!filter) {
    throw new Error("If you really want to run all the tests, use\n\tnode lib/run-tests I_AM_SURE");
  }

  tap.diag(`${chalk.gray("INFO")} Using ${agents.count} threads.`);

  let passed = 0;
  let finished = 0;
  let run = 0;
  let total = 0;

  for await (const test of tests) {
    total++;

    if (filter !== "I_AM_SURE" && !test.file.includes(filter)) continue;

    run++;

    agents.withAgent(async agent => {
      const expected = getExpected(test);
      const actual = await runTest(agent, test);

      finished++;

      const file = `${test.file} ${chalk.blue(test.scenario)}`;
      const progress = `- ${finished}/${run}`
      if (actual.result === expected) {
        passed++;
        tap.pass(
          `${chalk.green("PASS")} ${file} (${chalk.green(expected)}) ${progress}`,
          actual.output
        );
      } else {
        tap.fail(
          `${chalk.red("FAIL")} ${file} (expected ${expected}, got ${chalk.red(actual.result)}) ${progress}`,
          new Error(actual.error.message)
        );
      }
    });
  }

  await agents.close();

  tap.diag("\n\n");
  tap.diag(`Run ${run} out of ${total} tests.`);
  tap.diag(`Passed ${passed} out of ${run} tests.`);
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

  try {
    contents = transpile(contents, attrs.features);
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
