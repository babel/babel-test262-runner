const got = require('got');
const util = require('util');
const fs = require('fs');
const path = require('path');

const writeFile = util.promisify(fs.writeFile);

const TEST262_ARTIFACT_PATH = '~/test262.tap';

const { CIRCLECI_ACCESS_TOKEN } = process.env;

const CIRCLECI_API = `https://circleci.com/api/v2`;
const CIRCLECI_TEST262_WORKFLOWS_API = `${CIRCLECI_API}/insights/gh/babel/babel/workflows/test262?branch=main`;
const CIRCLECI_WORKFLOW_API = `${CIRCLECI_API}/workflow`
const CIRCLECI_JOB_API = `${CIRCLECI_API}/project/gh/babel/babel`;

/**
 * Algorithm:
 * 1. Fetch the JSON to get list of jobs on "main"
 *   1.a Map the jobs to `build_num` to get more info.
 * 2. Start querying each build artifacts in reverse chronological order
 * as it is not necessary that if the latest one has the test262-main.tap
 * artifact
 * 3. Once test262-main.tap artifact is found, download it to filesystem.
 */
async function main() {
    console.log(`Calling CircleCI API: ${CIRCLECI_TEST262_WORKFLOWS_API}`);
    const { items: workflows } = await getJSONData(CIRCLECI_TEST262_WORKFLOWS_API);
    const workflowsIds = workflows.slice(0, 20).map(workflow => workflow.id);
    const writeFilePath = getResolvedPath();
    await writeFile(writeFilePath, await findTest262Artifact(workflowsIds));
    console.log(`Successfully saved "main" artifact at: ${writeFilePath}`);
}

function getResolvedPath() {
    const pathArg = process.argv[2];
    return pathArg ?
        path.resolve(process.cwd(), pathArg) :
        `${process.cwd()}/test262-main.tap`;
}

async function findTest262Artifact(workflowsIds) {
    for (const workflowId of workflowsIds) {
        const { items: jobs } = await getJSONData(`${CIRCLECI_WORKFLOW_API}/${workflowId}/job`);
        if (jobs.length !== 1) {
            throw new Error(`Workflow ${workflowId} has more than one job.`)
        }
        const buildNum = jobs[0].job_number;

        const { items: buildArtifacts } = await getJSONData(`${CIRCLECI_JOB_API}/${buildNum}/artifacts`);
        const test262Artifact = buildArtifacts.find((artifact => artifact.path === TEST262_ARTIFACT_PATH));
        if (test262Artifact) {
            console.log(`Previous "main" build: ${buildNum}`);
            console.log(`Previous build link: https://app.circleci.com/jobs/github/babel/babel/${buildNum}`);
            console.log(`Previous build artifacts: https://app.circleci.com/jobs/github/babel/babel/${buildNum}/artifacts`);
            const test262ArtifactUrl = test262Artifact.url;
            console.log(`Previous build test262 artifact: ${test262ArtifactUrl}`);

            return getTextData(test262Artifact.url);
        }
        console.log(`Workflow ${workflowId} does not have a valid artifact.`)
    }
    throw new Error('Unable to find recent "main" build test262 artifact!');
}

const getJSONData = async url => {
    if (!CIRCLECI_ACCESS_TOKEN) {
        throw new Error("Missing CIRCLECI_ACCESS_TOKEN env variable. You can generate it at https://app.circleci.com/settings/user/tokens");
    }

    const { body } = await got(url, { json: true, auth: CIRCLECI_ACCESS_TOKEN,  });
    return body;
}

const getTextData = async url => {
    const { body } = await got(url);
    return body;
}

main();
