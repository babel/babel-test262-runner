/*---
description: Only runs in sloppy mode
flags: [noStrict]
---*/
assert.sameValue(typeof (function () { return this; })(), "object");
