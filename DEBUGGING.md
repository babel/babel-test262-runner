# Debugging test262 errors in CI

The [babel mono](https://github.com/babel/babel) runs test262 on CircleCI. This documents aims to serve as a guide for babel maintainers to debug CI errors arising due to babel-test262-runner **_this repo_**.

## Configuration

To see what the job is doing it's probably best to take a look at [config.yml](https://github.com/babel/babel/blob/master/.circleci/config.yml).

We run test262 tests using babel-test262-runner on babel monorepo. It is run on each PR (on manual trigger by babel maintainers) and also on master.

The tests are run on the master branch or PR. They are compared with the previous master branch test results. Only the changed results are rendered in the logs and CircleCI test results output.

## Known issues/Caveats

+ The test262 job compares against the previous master job. While this should not cause any issue, if someone were to manually trigger the master job for a relatively older commit, it will compare againt that. The way to resolve it would be to either land a new commit on master or rerun the master branch job for the most recent commit on master.
