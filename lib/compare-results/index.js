const parser = require('@tap-format/parser')
const path = require('path');
const fs = require('fs');
const _ = require('highland');
const diag = console.log.bind(console, '# ');

console.log('TAP version 13');

function bailOut(reason) {
    console.log(`Bail out! ${reason}`);
    process.exit(0); // tap-mocha-reporter will report correct failure code to CircleCI
}

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
    const mainArtifactFileArg = process.argv[2];
    const prArtifactFileArg = process.argv[3];
    if (!(mainArtifactFileArg && prArtifactFileArg)) {
        bailOut(`main branch and PR artifact file paths required. Usage: node lib/compare-results main.tap test262.tap`);
    }
    const mainArtifactFilePath = path.resolve(process.cwd(), mainArtifactFileArg);
    const prArtifactFilePath = path.resolve(process.cwd(), prArtifactFileArg);

    const [mainTests, prTests] = await Promise.all([parseTestResults(mainArtifactFilePath), parseTestResults(prArtifactFilePath)]);

    if (mainTests.length !== prTests.length) {
        diag(`main branch and PR artifacts are out of sync. Consider rebaing the PR.`);
    }
    const mainTestsMap = mainTests.reduce((acc, test) =>  {
        if (test.type === 'assertion') {
            acc[getFileNameFromTitle(test.title)] = test;
        }
        return acc;
    }, Object.create(null));

    let newFailures = 0;
    let newSuccesses = 0;
    for (let i = 0; i < prTests.length; i++) {
        const prTest = prTests[i];
        const fileName = getFileNameFromTitle(prTest.title);
        const mainTest = mainTestsMap[fileName];
        switch (prTest.type) {
            case 'assertion':
                if (!(fileName in mainTestsMap)) {
                    diag(`Ignoring test '${fileName}' as it was not found in main artifact!`);
                    continue;
                }
                if (prTest.ok !== mainTest.ok) {
                    if (prTest.ok) newSuccesses++;
                    else newFailures++;
                    console.log(prTest.raw);
                }
                break;
        }
    }
    console.log(`1..${newFailures + newSuccesses}`);

    if (newFailures > 0) process.exitCode = 1;
}

main();
