module.exports = function shouldIgnore(test) {
  if (test.file.startsWith("test/intl402")) return true;
  if (test.attrs.features.includes("Proxy")) return true;
  return false;
};
