const parser = require('@tap-format/parser')
const path = require('path');
const fs = require('fs');
const _ = require('highland');

function throwIncorrectArgumentError() {
    throw new Error(`master branch and PR artifact file paths required
    Usage: node lib/compare-results master.tap test262.tap
    `);
}

function throwMasterArtifactOutOfSyncError() {
    throw new Error(`master branch and PR artifacts are out of sync. Was test262 sha updated in babel-test-runner?
    Consider re-running the master branch test262 job to update the master branch artifact first!
    `);
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

    if (masterTests.length !== prTests.length) {
        console.error('Master and PR artifacts out of sync! Reason: Different number of tests.');
        throwMasterArtifactOutOfSyncError();
    }
    const masterTestsMap = masterTests.reduce((acc, test) =>  {
        acc[test.title] = test;
        return acc;
    }, {});
    for (let i = 0; i < prTests.length; i++) {
        const prTest = prTests[i];
        if (!Object.prototype.hasOwnProperty.call(masterTestsMap, prTest.title)) {
            console.log(`# Ignoring test '${prTest.title}' as it was not found in master artifact!`);
            continue;
        }
        const masterTest = masterTestsMap[prTest.title];
        switch (prTest.type) {
            case 'version':
                console.log(prTest.raw);
                break;
            case 'assertion':
                if (prTest.ok !== masterTest.ok) {
                    console.log(prTest.raw);
                }
                break;
        }
    }
}

main();
