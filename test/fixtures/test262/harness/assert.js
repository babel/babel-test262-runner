var assert = {
  sameValue: function (actual, expected) {
    if (actual !== expected) {
      throw new Test262Error("Expected " + expected + " but got " + actual);
    }
  },
};
