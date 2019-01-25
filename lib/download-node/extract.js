"use strict";

const targz = require("targz");

module.exports = function extract(src, dest) {
  return new Promise((resolve, reject) => {
    targz.decompress({ src, dest }, err => {
      if (err) reject(err);
      else resolve();
    });
  });
};
