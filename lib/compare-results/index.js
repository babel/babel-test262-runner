const parser = require('@tap-format/parser')
const path = require('path');
const fs = require('fs');
// const tap = require('make-tap-output')({ count: true });
const _ = require('highland');

const diag = console.log.bind(console, '# ');

// tap.pipe(process.stdout);

function throwError() {
    throw new Error(`master branch and PR artifact file paths required
    Usage: node lib/compare-results master.tap test262.tap
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
        throwError();
    }
    const masterArtifactFilePath = path.resolve(process.cwd(), masterArtifactFileArg);
    const prArtifactFilePath = path.resolve(process.cwd(), prArtifactFileArg);

    const masterTests = await parseTestResults(masterArtifactFilePath);
    const prTests = await parseTestResults(prArtifactFilePath);

    for (let i = 0; i < masterTests.length; i++) {
        const prTest = prTests[i];
        const masterTest = masterTests[i];
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
