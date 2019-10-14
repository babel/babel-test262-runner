module.exports = function shouldIgnore(test) {
  if (!test.file.startsWith("test/language")) return true;
  return false;
};
