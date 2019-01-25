"use strict";

if (process.platform !== "linux" || require("os").arch() !== "x64") {
  throw new Error("Only linux64 is supported.");
}

const NODE_URL = "https://nodejs.org/dist/latest-v0.10.x/node-v0.10.48-linux-x64.tar.gz";
const CHECKSUM = "82f5fe186349ca69d8889d1079dbb86ae77ce54fce5282b806c359ce360cec7b";

const path = require("path");

const download = require("./download");
const extract = require("./extract");
const remove = require("./remove");

async function main() {
  const engineDir = path.join(__dirname, "../../engine");

  console.log("Removing old engine");
  await remove(engineDir);

  console.log("Downloading node-v0.10.48-linux-x64.tar.gz");
  const { path: tmp, sha256 } = await download(NODE_URL);

  console.log("Verifying checksum");
  if (sha256 !== CHECKSUM) {
    throw new Error("The checksum doesn't match. Please run this script again");
  }

  console.log("Extracting to engine/");
  await extract(tmp, engineDir);

  console.log("Deleting tmp download file");
  await remove(tmp);
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
