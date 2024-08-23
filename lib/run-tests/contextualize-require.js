const path = require('path');

const babelPath = process.env.BABEL_PATH ?
    path.resolve(process.cwd(), process.env.BABEL_PATH) :
    undefined;

module.exports = function contextualizeRequire(path) {
    if (!babelPath) {
        return require(path);
    }
    const newPath = `${babelPath}/${path.replace('@babel/', 'packages/babel-')}`;
    try {
        return require(newPath);
    } catch (e) {
        console.error("Require of " + newPath + " from local clone failed with error: " + e);
        process.exitCode = 1;
        return require(path);
    }
};
