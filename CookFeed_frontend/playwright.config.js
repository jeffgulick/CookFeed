// Browser smoke tests for the prototype (tests/smoke). The pages are opened straight from the file system,
// the way the prototype is handed in, so baseURL is the prototype folder as a file:// URL.
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests/smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // CI keeps an HTML report to upload when the job fails; locally the list is enough.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: pathToFileURL(path.join(__dirname, "prototype")).href + "/",
    trace: "retain-on-failure"
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }]
});
