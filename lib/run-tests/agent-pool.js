"use strict";

const BabelAgent = require("./babel-agent");

const NUM_CORES = require("os").cpus().length;

class AgentPool {
  constructor(hostPath, count = NUM_CORES) {
    this.agents = [];
    this.queue = [];
    this.closed = false;
    this.count = count;
    this.done = new Promise(resolve => this.resolvePromise = resolve);

    for (let i = 0; i < count; i++) {
      const agent = new BabelAgent({ hostPath });
      this.agents.push(agent);
    }
  }

  withAgent(run) {
    this.queue.push(run);
    this._runQueue();
  }

  close() {
    this.closed = true;
    this._maybeResolvePromise();
    return this.done;
  }

  _runQueue() {
    while (this.agents.length && this.queue.length) {
      const agent = this.agents.pop();
      const run = this.queue.shift();
      run(agent).finally(() => {
        this.agents.push(agent);
        this._runQueue();
      });
    }

    this._maybeResolvePromise();
  }

  _maybeResolvePromise() {
    if (
      this.closed &&
      this.queue.length === 0 && 
      this.agents.length === this.count
    ) {
      this.resolvePromise();
    }
  }
}

module.exports = AgentPool;
