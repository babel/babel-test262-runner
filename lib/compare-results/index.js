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
    return new Promise((resolve) => {
        _(fs.createReadStream(filePath).pipe(parser.stream())).toArray(results => resolve(results.map(buffer => JSON.parse(buffer.toString()))));
    });
}

async function main() {
    const masterArtifactFileArg = process.argv[2];
    const prArtifactFileArg = process.argv[3];
    if (!(masterArtifactFileArg && prArtifactFileArg)) {
        throwIncorrectArgumentError();
    }
    const masterArtifactFilePath = path.resolve(process.cwd(), masterArtifactFileArg);
    const prArtifactFilePath = path.resolve(process.cwd(), prArtifactFileArg);

    const masterTests = await parseTestResults(masterArtifactFilePath);
    const prTests = await parseTestResults(prArtifactFilePath);

    for (let i = 0; i < masterTests.length; i++) {
        const prTest = prTests[i];
        const masterTest = masterTests[i];
        if (prTest.title !== masterTest.title) {
            console.log('Master and PR artifacts out of sync! Diff:');
            console.log('PR: ', prTest.raw);
            console.log('Master: ', masterTest.raw);
            throwMasterArtifactOutOfSyncError()
        }
        switch (prTest.type) {
            case 'version':
                console.log(prTest.raw);
                break;
            case 'assertion':
                if (prTest.ok !== masterTest.ok) {
                    console.log(prTest.raw);
                }
                break;
            default:
                break;
        }
    }
}

main();
