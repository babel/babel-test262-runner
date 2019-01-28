var vm = require("vm");
var fs = require("fs");

var $ = {
  global: Function("return this")(),
  createRealm: function createRealm(options) {
    options = options || {};
    options.globals = options.globals || {};
    context = {
      console: console,
      require: require
    };

    for (var glob in options.globals) {
      context[glob] = options.globals[glob];
    }

    var context = vm.createContext(context);
    for (var i = 0; i < this.polyfills.length; i++) {
      vm.runInContext(this.polyfills[i], context);
    }
    vm.runInContext(this.source, context);
    context.$.source = this.source;
    context.$.context = context;

    context.$.destroy = function() {
      if (options.destroy) {
        options.destroy();
      }
    };

    return context.$;
  },
  evalScript: function evalScript(code) {
    try {
      if (this.context) {
        vm.runInContext(code, this.context, {
          displayErrors: false
        });
      } else {
        vm.runInESHostContext(code, {
          displayErrors: false
        });
      }

      return {
        type: "normal",
        value: undefined
      };
    } catch (e) {
      return {
        type: "throw",
        value: e
      };
    }
  },
  getGlobal: function getGlobal(name) {
    return this.global[name];
  },
  setGlobal: function setGlobal(name, value) {
    this.global[name] = value;
  },
  destroy: function destroy() {
    /* noop */
  },
  IsHTMLDDA: function IsHTMLDDA() {
    return {};
  },
  source: $SOURCE,
  polyfills: $POLYFILLS,
};

function print() {
  console.log.apply(console, arguments);
}
