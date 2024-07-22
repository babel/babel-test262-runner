import fs from 'fs/promises';
import path from 'path';
import { Octokit } from '@octokit/core';
import { unzip } from 'unzipit';

const {
    GITHUB_TOKEN,
    REPO_OWNER = 'babel',
    REPO_NAME = 'babel',
    BRANCH = 'main',
    WORKFLOW_NAME = 'ci.yml',
    ARTIFACT_NAME = 'test262-result',
    ARTIFACT_FILE = 'test262.tap',
} = process.env;

const octokit = new Octokit({ auth: GITHUB_TOKEN })

let artifact;
for (let page = 1;; page++) {
    const { workflow_runs: [workflow] } = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs?branch={branch}&per_page=1&page={page}', {
        workflow_id: WORKFLOW_NAME,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        branch: BRANCH,
        page: page
    }).then(handleErrors);
    const { artifacts } = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts', {
        owner: REPO_OWNER,
        repo: REPO_NAME,
        run_id: workflow.id,
    }).then(handleErrors);
    artifact = artifacts.find(a => a.name === ARTIFACT_NAME);
    if (artifact) break;
}

if (!artifact) {
    throw new Error('Cannot find previous artifact');
}

const archive = await octokit.request('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip', {
    owner: REPO_OWNER,
    repo: REPO_NAME,
    artifact_id: artifact.id,
}).then(handleErrors);

const { entries } = await unzip(archive);

if (!entries[ARTIFACT_FILE]) {
    throw new Error('Cannot artifact file');
}

const outputPath = path.resolve(process.cwd(), process.argv[2] ?? 'test262-main.tap');

await fs.writeFile(outputPath, await entries[ARTIFACT_FILE].text());

function handleErrors(response) {
    if (response.status !== 200) return Promise.reject(response);
    return response.data;
}
