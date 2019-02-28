"use strict";

const path = require("path");
const Test262Stream = require("test262-stream");
const chalk = require("chalk");

const NODE = path.join(__dirname, "../../engine/node/bin/node");
const TESTS = path.join(__dirname, "../../test262");

const AgentPool = require("./agent-pool");
const transpile = require("./transpile");

async function main() {
  const agents = new AgentPool(NODE);
  const tests = new Test262Stream(TESTS);

  const filter = process.argv[2];
  if (!filter) {
    throw new Error("If you really want to run all the tests, use\n\tnode lib/run-tests I_AM_SURE");
  }

  let passed = 0;
  let run = 0;
  let total = 0;

  for await (const test of tests) {
    total++;

    if (filter !== "I_AM_SURE" && !test.file.includes(filter)) continue;

    run++;

    agents.withAgent(async agent => {
      const expected = getExpected(test);
      const actual = await runTest(agent, test);

      const file = `${test.file} ${chalk.blue(test.scenario)}`;
      if (actual.result === expected) {
        passed++;
        console.log(`${chalk.green("PASS")} ${file} (${chalk.green(expected)})`);
      } else {
        console.log(`${chalk.red("FAIL")} ${file} (expected ${expected}, got ${chalk.red(actual.result)})`);
        /*if (actual.error) {
          console.log(indent(actual.error.message));
        } else {
          console.log(indent(actual.output));
        }*/
      }
    });
  }
  
  await agents.close();

  console.log("\n\n");
  console.log(`Run ${run} out of ${total} tests.`);
  console.log(`Passed ${passed} out of ${run} tests.`);
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

  const result = await agent.evalScript({
    attrs,
    contents,
    file: path.join(TESTS, file),
  });

  if (result.error) {
    return { result: "runtime error", error: result.error };
  } else {
    return { result: "success", output: result.stdout };
  }
}

function indent(str) {
  return str.split("\n").map(r => "\t" + r).join("\n");
}
