"use strict";

const requireBabel = require("./contextualize-require");
/**
 * @type {import("@babel/core")}
 */
const {
  transformSync,
  loadOptionsSync,
  parseSync,
  traverse,
} = requireBabel("@babel/core");
/**
 * @type {import("@babel/preset-env")}
 */
const presetEnv = requireBabel("@babel/preset-env");

const getBabelPlugins = require("./get-babel-plugins");

const configCaches = new Map();

function getOptions(features, isModule) {
  const configKey = JSON.stringify({ features, isModule });
  let config = configCaches.get(configKey);
  if (config !== undefined) {
    return config;
  }
  config = loadOptionsSync({
    configFile: false,
    babelrc: false,
    targets: "node 0.10",
    presets: [[presetEnv, { modules: "commonjs" }]],
    // spec
    assumptions: {
      noNewArrows: false,
    },
    plugins: getBabelPlugins(features),
    sourceType: isModule ? "module" : "script",
    highlightCode: false,
    generatorOpts: { compact: true },
  });

  configCaches.set(configKey, config);
  return config;
}

function transpile(code, { features, isModule, isStrict } = {}) {
  if (isStrict && !isModule && !/^\s*['"]use strict['"]/.test(code)) {
    // eval("") === undefined
    code = `"use strict";\nundefined;\n${code}`;
  }
  const ret = transformSync(
    code,
    getOptions(features || [], Boolean(isModule))
  ).code;
  return ret;
}

// Map { kind => Set of the names of the bindings of that kind } of the program
// scope of a script, including the `var`s and functions nested in blocks.
function programBindings(code) {
  const ast = parseSync(code, {
    configFile: false,
    babelrc: false,
    sourceType: "script",
  });
  const bindings = new Map();
  traverse(ast, {
    Program(path) {
      for (const [name, binding] of Object.entries(path.scope.bindings)) {
        if (!bindings.has(binding.kind)) bindings.set(binding.kind, new Set());
        bindings.get(binding.kind).add(name);
      }
      path.stop();
    },
  });
  return bindings;
}

const allNames = bindings => [...bindings.values()].flatMap(names => [...names]);

const harnessCache = new Map();

// `harness` is the part of a test before its `insertionIndex`: the harness
// files it includes, after a "use strict" directive in strict mode.
function compileHarness(harness, features) {
  const key = JSON.stringify(features) + "\n" + harness;
  let compiled = harnessCache.get(key);
  if (compiled === undefined) {
    const code = transpile(harness, { features });
    const source = programBindings(harness);
    const names = allNames(programBindings(code));
    // A test using one of these names could be compiled differently on its
    // own, so it is compiled with the harness instead:
    // - the bindings Babel created in the harness, such as helpers, which
    //   it would have named differently if it had seen the test;
    // - the `let`, `const` and `class` bindings of the harness, which the
    //   test only sees as `var`s.
    const sourceNames = new Set(allNames(source));
    const avoid = names
      .filter(name => !sourceNames.has(name))
      .concat(
        ["let", "const", "class"].flatMap(kind => [...(source.get(kind) ?? [])])
      );
    compiled = {
      code,
      strict: /^"use strict";/.test(harness),
      // Declares the bindings of the harness, so that Babel takes them into
      // account when compiling the test. At runtime, it does nothing.
      prelude: names.length ? `var ${names.join(", ")};\n` : "void 0;\n",
      avoid: avoid.length
        ? new RegExp(`(?<![\\w$])(?:${avoid.map(escapeRegExp).join("|")})(?![\\w$])`)
        : null,
    };
    harnessCache.set(key, compiled);
  }
  return compiled;
}

function escapeRegExp(string) {
  return string.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

// Compiles a test from @babel/test262-stream.
//
// The harness files take about a third of the time Babel spends compiling a
// test, and most tests include the same few of them. So for scripts, the
// harness is compiled once and the test on its own, as if it followed the
// harness: with the harness's bindings declared before it, which also keeps a
// "use strict" at the start of the test from becoming a directive.
function transpileTest({ attrs, contents, insertionIndex }) {
  const features = attrs.features || [];
  const isModule = Boolean(attrs.flags.module);
  if (isModule || !(insertionIndex > 0)) {
    return transpile(contents, { features, isModule });
  }

  let harness;
  try {
    harness = compileHarness(contents.slice(0, insertionIndex), features);
  } catch {
    // Report the error that compiling the whole test throws, if any.
    return transpile(contents, { features });
  }
  const test = contents.slice(insertionIndex);
  if (harness.avoid?.test(test)) {
    return transpile(contents, { features });
  }

  const directive = harness.strict ? `"use strict";\n` : "";
  return `${harness.code}\n${transpile(directive + harness.prelude + test, {
    features,
  })}`;
}

module.exports = transpile;
module.exports.transpileTest = transpileTest;
