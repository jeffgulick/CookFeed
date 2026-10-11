/* Loads the prototype's data and rule scripts the way a page does, in order, into a fresh sandbox with
   an in-memory localStorage, so the tests exercise exactly the code the browser runs. Each call returns
   a new sandbox: nothing a test stores leaks into the next one. */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const JS = path.join(__dirname, "..", "prototype", "js");
const SCRIPTS = ["seed-data.js", "db.js", "rules.js"];

class MemoryStorage {
  constructor() { this.items = new Map(); }
  getItem(key) { return this.items.has(key) ? this.items.get(key) : null; }
  setItem(key, value) { this.items.set(key, String(value)); }
  removeItem(key) { this.items.delete(key); }
}

function loadPrototype(storage = new MemoryStorage()) {
  const sandbox = { localStorage: storage, console };
  // The scripts address globals through window (window.COOKFEED_SEED, window.localStorage).
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const file of SCRIPTS) {
    vm.runInContext(fs.readFileSync(path.join(JS, file), "utf8"), sandbox, { filename: file });
  }
  return sandbox;
}

module.exports = { loadPrototype, MemoryStorage };
