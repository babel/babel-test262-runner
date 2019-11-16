const path = require('path');

const babelPath = process.env.BABEL_PATH ?
    path.resolve(process.cwd(), process.env.BABEL_PATH) :
    undefined;

module.exports = function contextualizeRequire(path) {
    if (!babelPath) {
        return require(path);
    }
    const newPath = `${babelPath}/${path.replace('@babel/', 'packages/babel-')}`;
    return require(newPath);
};
