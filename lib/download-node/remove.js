"use strict";

const rimraf = require("rimraf");

module.exports = function remove(path) {
  return new Promise((resolve, reject) => {
    rimraf(path, { glob: false }, err => {
      if (err) reject(err);
      else resolve();
    })
  });
};
