import path from "path";
import { Readable } from "stream";
import { createWriteStream } from "fs";
import { Octokit } from "@octokit/core";
import { zip } from "compressing";

const {
  GITHUB_TOKEN,
  REPO_OWNER = "babel",
  REPO_NAME = "babel",
  BRANCH = "main",
  WORKFLOW_NAME = "ci.yml",
  ARTIFACT_NAME = process.argv[3] ?? "test262-result",
  ARTIFACT_FILE = "test262.tap",
} = process.env;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

let artifact;
for (let page = 1; page < 100; page++) {
  const {
    workflow_runs: [workflow],
  } = await octokit
    .request(
      "GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs?branch={branch}&per_page=1&page={page}",
      {
        workflow_id: WORKFLOW_NAME,
        owner: REPO_OWNER,
        repo: REPO_NAME,
        branch: BRANCH,
        page: page,
      }
    )
    .then(handleErrors);
  const { artifacts } = await octokit
    .request("GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts", {
      owner: REPO_OWNER,
      repo: REPO_NAME,
      run_id: workflow.id,
    })
    .then(handleErrors);
  artifact = artifacts.find(a => a.name === ARTIFACT_NAME);
  if (artifact) break;
}

if (!artifact) {
  throw new Error("Cannot find previous artifact");
}

const archive = await octokit
  .request("GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip", {
    owner: REPO_OWNER,
    repo: REPO_NAME,
    artifact_id: artifact.id,
  })
  .then(handleErrors);

let found = false;
await new Promise((resolve, reject) => {
  new Readable.from(Buffer.from(archive)).pipe(
    new zip.UncompressStream()
      .on("error", reject)
      .on("finish", resolve)
      .on("entry", (header, stream, next) => {
        stream.on("end", next);
        if (header.name.endsWith(ARTIFACT_FILE)) {
          found = true;
          stream.pipe(
            createWriteStream(
              path.resolve(process.cwd(), process.argv[2] ?? "test262-main.tap")
            )
          );
        } else {
          stream.resume();
        }
      })
  );
});

if (!found) {
  throw new Error("Cannot artifact file");
}

function handleErrors(response) {
  if (response.status !== 200) return Promise.reject(response);
  return response.data;
}
