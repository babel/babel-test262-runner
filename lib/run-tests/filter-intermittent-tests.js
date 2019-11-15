const fs = require('fs');

const intermittentTests = fs.readFileSync(`${__dirname}/../../intermittent-tests.txt`, 'utf-8')
    .trim()
    .split(/\r?\n/);

module.exports = function filterIntermittentTests(file) {
    return intermittentTests.includes(file);
}
