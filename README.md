# Babel Test262

> NOTE: Only linux64 and darwin64 are currently supported.

## Installation

```
git clone [url of this repo] --recursive --shallow-submodules
cd babel-test262
node lib/download-node
```

## Run tests

```
node lib/run-tests [pattern]
```

`[pattern]` must be a substring of the path of the tests to run. For example:

```
node lib/run-tests arrow-functions
```
