const parser = require('@tap-format/parser')
const path = require('path');
const fs = require('fs');
const _ = require('highland');
const diag = console.log.bind(console, '# ');
function throwIncorrectArgumentError() {
    throw new Error(`master branch and PR artifact file paths required
    Usage: node lib/compare-results master.tap test262.tap
    `);
}

console.log('TAP version 13');

function getFileNameFromTitle(title) {
    return title ?
        title.split('#')[0].trim() :
        undefined;
}

function parseTestResults(filePath) {
    return new Promise(resolve => _(fs.createReadStream(filePath).pipe(parser.stream()))
        .map(buffer => JSON.parse(buffer.toString()))
        .toArray(results => resolve(results)));
}

async function main() {
    const masterArtifactFileArg = process.argv[2];
    const prArtifactFileArg = process.argv[3];
    if (!(masterArtifactFileArg && prArtifactFileArg)) {
        throwIncorrectArgumentError();
    }
    const masterArtifactFilePath = path.resolve(process.cwd(), masterArtifactFileArg);
    const prArtifactFilePath = path.resolve(process.cwd(), prArtifactFileArg);

    const [masterTests, prTests] = await Promise.all([parseTestResults(masterArtifactFilePath), parseTestResults(prArtifactFilePath)]);

    const masterTestsMap = masterTests.reduce((acc, test) =>  {
        if (test.type === 'assertion') {
            acc[getFileNameFromTitle(test.title)] = test;
        }
        return acc;
    }, Object.create(null));

    let count = 0;
    for (let i = 0; i < prTests.length; i++) {
        const prTest = prTests[i];
        const fileName = getFileNameFromTitle(prTest.title);
        if (prTest.type === 'assertion') {
            if (fileName in masterTestsMap) {
                const masterTest = masterTestsMap[fileName];
                if (prTest.ok !== masterTest.ok) {
                    ++count;
                    // This reports existing tests which changed result
                    console.log(prTest.raw);
                }
            }
            else {
                // This reports new tests which were not seen previously
                // whether they are passing/failing
                console.log(prTest.raw);
            }
        }
    }
    console.log(`1..${count}`);
}

main();
