"use strict";

const { tgz } = require("compressing");
const { rmSync, mkdirSync, writeFileSync, createWriteStream } = require("fs");
const { createHash } = require("crypto");
const { Readable } = require("stream");
const path = require("path");

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

async function main() {
  const engineDir = path.join(__dirname, "../../engine/node/bin");

  console.log("Removing old engine");
  rmSync(engineDir, { recursive: true, force: true });
  mkdirSync(engineDir, { recursive: true });

  console.log(`Downloading ${NODE_DOWNLOAD_NAME}`);
  const buffer = Buffer.from(await (await fetch(NODE_URL)).arrayBuffer());

  console.log("Verifying checksum");
  if (createHash("sha256").update(buffer).digest("hex") !== CHECKSUM) {
    throw new Error("The checksum doesn't match. Please run this script again");
  }

  console.log("Writing to engine/");
  if (isWin) {
    writeFileSync(path.join(engineDir, "node.exe"), buffer);
  } else {
    await new Promise((resolve, reject) => {
      new Readable.from(buffer).pipe(
        new tgz.UncompressStream()
          .on("error", reject)
          .on("finish", resolve)
          .on("entry", (header, stream, next) => {
            stream.on("end", next);
            if (header.name.endsWith("bin/node")) {
              stream.pipe(
                createWriteStream(path.join(engineDir, "node"), { mode: 0o755 })
              );
            } else {
              stream.resume();
            }
          })
      );
    });
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
