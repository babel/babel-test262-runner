"use strict";

const got = require("got");
const ProgressBar = require("progress");
const tempy = require("tempy");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

module.exports = function download(url) {
  return new Promise((resolve, reject) => {
    const bar = new ProgressBar("  [:bar] :percent", {
      complete: "=",
      incomplete: " ",
      width: 60,
      total: 100
    });

    const filePath = tempy.file({
      name: path.basename(url)
    });

    const sha256 = crypto.createHash("sha256");

    const response = got
      .stream(url, { encoding: null })
      .on("downloadProgress", progress => bar.update(progress.percent))
      .on("error", reject)
      .on("data", data => sha256.update(data))
      .on("end", () => {
        // Clear the progress bar.
        console.log('\x1B[1A\x1B[2K\x1B[1A');

        resolve({
          path: filePath,
          sha256: sha256.digest("hex"),
        });
      });

    response.pipe(fs.createWriteStream(filePath));
  });
};
