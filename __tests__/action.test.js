// Basic test to ensure the action can be loaded
describe("GitHub Action", () => {
  test("package.json exists and has correct structure", () => {
    const packageJson = require("../package.json");

    // Check that package.json has required fields
    expect(packageJson).toHaveProperty("name");
    expect(packageJson).toHaveProperty("version");
    expect(packageJson).toHaveProperty("scripts");
    expect(packageJson.scripts).toHaveProperty("build");
    expect(packageJson.scripts).toHaveProperty("test");
  });

  test("action.yml exists and has correct structure", () => {
    const fs = require("fs");
    const yaml = require("js-yaml");

    // Check that action.yml exists
    expect(fs.existsSync("./action.yml")).toBe(true);

    // Try to parse action.yml
    let actionYml;
    try {
      const fileContents = fs.readFileSync("./action.yml", "utf8");
      actionYml = yaml.load(fileContents);
    } catch (e) {
      // If parsing fails, fail the test
      expect(e).toBeNull();
    }

    // Check that action.yml has required fields
    expect(actionYml).toHaveProperty("name");
    expect(actionYml).toHaveProperty("description");
    expect(actionYml).toHaveProperty("runs");
    expect(actionYml.runs).toHaveProperty("using");
    expect(actionYml.runs).toHaveProperty("main");
    expect(actionYml.runs.main).toBe("dist/index.js");
  });
});
