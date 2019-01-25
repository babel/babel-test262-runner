"use strict";

const path = require("path");
const eshost = require("eshost");

const NODE = path.join(__dirname, "../../engine/node-v0.10.48-linux-x64/bin/node");

const BabelAgent = require("./babel-agent");

async function main() {
  const agent = new BabelAgent({ hostPath: NODE });
  const result = await agent.evalScript("print(1 + 1)");

  console.log(result);
}
main();
