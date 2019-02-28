# Babel Test262

> NOTE: Only linux64 and darwin64 are currently supported.

Run test262 tests on Node 0.10 using Babel 7 and `core-js@3`.

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
node lib/run-tests arrow-function
```

If you want to run **all** the tests, run

```
node lib/run-tests I_AM_SURE
```
