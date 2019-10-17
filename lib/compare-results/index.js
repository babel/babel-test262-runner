const Parser = require('tap-parser');
const path = require('path');
const fs = require('fs');
const tap = require('make-tap-output')({ count: true });

tap.pipe(process.stdout);

function throwError() {
    throw new Error(`master branch and PR artifact file paths required
    Usage: node lib/compare-results master.tap test262.tap
    `);
}

async function main() {
    const masterParser = new Parser();
    const prParser = new Parser();

    const masterTests = [];
    const prTests = [];

    masterParser.on('line', line => masterTests.push(line));
    prParser.on('line', line => prTests.push(line));

    const masterArtifactFileArg = process.argv[2];
    const prArtifactFileArg = process.argv[3];
    if (!masterArtifactFileArg || !prArtifactFileArg) {
        throwError();
    }
    const masterArtifactFilePath = path.resolve(process.cwd(), masterArtifactFileArg);
    const prArtifactFilePath = path.resolve(process.cwd(), prArtifactFileArg);

    fs.createReadStream(masterArtifactFilePath).pipe(masterParser);
    fs.createReadStream(prArtifactFilePath).pipe(prParser);

}

main();
