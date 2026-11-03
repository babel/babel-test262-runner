/*---
description: Only runs in strict mode
flags: [onlyStrict]
---*/
assert.sameValue((function () { return this; })(), undefined);
