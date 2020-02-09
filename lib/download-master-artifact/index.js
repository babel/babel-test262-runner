const got = require('got');
const util = require('util');
const fs = require('fs');
const path = require('path');

const writeFile = util.promisify(fs.writeFile);

const CIRCLECI_BABEL_API = 'https://circleci.com/api/v1.1/project/github/babel/babel';
const CIRCLECI_BABEL_MASTER_BUILD_API = `${CIRCLECI_BABEL_API}/tree/master`;
const TEST262_ARTIFACT_PATH = '~/test262.tap';

/**
 * Algorithm:
 * 1. Fetch the JSON to get list of jobs on master
 *   1.a Map the jobs to `build_num` to get more info.
 * 2. Start querying each build artifacts in reverse chronological order
 * as it is not necessary that if the latest one has the test262.tap artifact
 * 3. Once test262.tap artifact is found, download it to filesystem.
 */
async function main() {
    console.log(`Calling CircleCI API: ${CIRCLECI_BABEL_MASTER_BUILD_API}`);
    const builds = await getJSONData(CIRCLECI_BABEL_MASTER_BUILD_API);
    const buildNums = builds.map(build => build.build_num);
    const writeFilePath = getResolvedPath();
    await writeFile(writeFilePath, await findTest262Artifact(buildNums));
    console.log(`Successfully saved master artifact at: ${writeFilePath}`);
}

function getResolvedPath() {
    const pathArg = process.argv[2];
    return pathArg ?
        path.resolve(process.cwd(), pathArg) :
        `${process.cwd()}/master.tap`;
}

async function findTest262Artifact(buildNums) {
    for (buildNum of buildNums) {
        const buildArtifacts = await getJSONData(`${CIRCLECI_BABEL_API}/${buildNum}/artifacts`);
        const test262Artifact = buildArtifacts.find((artifact => artifact.path === TEST262_ARTIFACT_PATH));
        if (test262Artifact) {
            console.log(`Previous master build: ${buildNum}`);
            console.log(`Previous build link: https://app.circleci.com/jobs/github/babel/babel/${buildNum}`);
            console.log(`Previous build artifacts: https://app.circleci.com/jobs/github/babel/babel/${buildNum}/artifacts`);
            const test262ArtifactUrl = test262Artifact.url;
            console.log(`Previous build test262 artifact: ${test262ArtifactUrl}`);

            return getTextData(test262Artifact.url);
        }
    }
    throw new Error('Unable to find recent master build test262 artifact!');
}

const getJSONData = async url => {
    const { body } = await got(url, { json: true });
    return body;
}

const getTextData = async url => {
    const { body } = await got(url);
    return body;
}

main();
