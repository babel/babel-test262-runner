"use strict";

const { platform } = process;
const arch = require("os").arch();

const isValidPlatform =
  ((platform === "linux" || platform === "win32") && arch === "x64") ||
  (platform === "darwin" && (arch === "arm64" || arch === "x64"));

if (!isValidPlatform) {
  throw new Error("Only 64-bit linux, darwin and windows are supported.");
}

const isWin = platform === "win32";

const NODE_NAME = isWin ? "x64/node.exe" : `node-v0.10.48-${platform}-x64`;
const NODE_DOWNLOAD_NAME = isWin ? NODE_NAME : `${NODE_NAME}.tar.gz`;
const NODE_URL = `https://nodejs.org/dist/latest-v0.10.x/${NODE_DOWNLOAD_NAME}`;
const CHECKSUM = {
  linux: "82f5fe186349ca69d8889d1079dbb86ae77ce54fce5282b806c359ce360cec7b",
  darwin: "35d510ca5e8dd0c21cb11c2bf33b90f3715f92281aaaa49645f61c565c8adceb",
  win32: "5d8cb2b12068166be30b48dcfd03bb46aee81d9e61f13fe4a650603e9ab1b951",
}[platform];

const path = require("path");
const symlink = require("util").promisify(require("fs").symlink);

const download = require("./download");
const extract = require("./extract");
const remove = require("./remove");
const copy = require("fs/promises").copyFile;
const mkdir = require("fs/promises").mkdir;

async function main() {
  const engineDir = path.join(__dirname, "../../engine");

  console.log("Removing old engine");
  await remove(engineDir);

  console.log(`Downloading ${NODE_DOWNLOAD_NAME}`);
  const { path: tmp, sha256 } = await download(NODE_URL);

  console.log("Verifying checksum");
  if (sha256 !== CHECKSUM) {
    throw new Error("The checksum doesn't match. Please run this script again");
  }

  if (isWin) {
    console.log("Copying to engine/");
    await mkdir(`${engineDir}/node/bin`, { recursive: true });
    await copy(tmp, `${engineDir}/node/bin/node.exe`);
  } else {
    console.log("Extracting to engine/");
    await extract(tmp, engineDir);

    console.log("Creating engine/node symlink");
    await symlink(`${engineDir}/${NODE_NAME}`, `${engineDir}/node`);
  }

  console.log("Deleting tmp download file");
  await remove(tmp);
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
