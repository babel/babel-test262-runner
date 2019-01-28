"use strict";

if ((process.platform !== "linux" && process.platform !== "darwin") || require("os").arch() !== "x64") {
  throw new Error("Only 64-bit linux and darwin are supported.");
}

const NODE_NAME = `node-v0.10.48-${process.platform}-x64`;
const NODE_URL = `https://nodejs.org/dist/latest-v0.10.x/${NODE_NAME}.tar.gz`;
const CHECKSUM = {
  linux: "82f5fe186349ca69d8889d1079dbb86ae77ce54fce5282b806c359ce360cec7b",
  darwin: "35d510ca5e8dd0c21cb11c2bf33b90f3715f92281aaaa49645f61c565c8adceb",
}[process.platform];

const path = require("path");
const symlink = require("util").promisify(require("fs").symlink);

const download = require("./download");
const extract = require("./extract");
const remove = require("./remove");

async function main() {
  const engineDir = path.join(__dirname, "../../engine");

  console.log("Removing old engine");
  await remove(engineDir);

  console.log(`Downloading ${NODE_NAME}.tar.gz`);
  const { path: tmp, sha256 } = await download(NODE_URL);

  console.log("Verifying checksum");
  if (sha256 !== CHECKSUM) {
    throw new Error("The checksum doesn't match. Please run this script again");
  }

  console.log("Extracting to engine/");
  await extract(tmp, engineDir);

  console.log("Creating engine/node symlink");
  await symlink(`${engineDir}/${NODE_NAME}`, `${engineDir}/node`);

  console.log("Deleting tmp download file");
  await remove(tmp);
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
