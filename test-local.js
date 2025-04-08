const fs = require("fs");
const { execSync } = require("child_process");

// Function to check if act is installed
function checkActInstalled() {
  try {
    execSync("act --version", { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to modify the runner.ts file for testing
function modifyRunnerForTesting() {
  const runnerPath = "src/esbmc/runner.ts";
  const originalContent = fs.readFileSync(runnerPath, "utf8");

  // Save original content for restoration
  fs.writeFileSync(`${runnerPath}.bak`, originalContent);

  // Modify the parseESBMCOutput function to always return success for testing
  const modifiedContent = originalContent.replace(
    /export function parseESBMCOutput\([^}]*}\)/s,
    `export function parseESBMCOutput(
  output: string,
  clarityFile: string,
  functionName: string
): ESBMCResult {
  // For testing, always return success
  console.log("Mock ESBMC: Always returning success for testing");
  return {
    verified: true,
    failures: [],
    rawOutput: output,
    clarityFile,
    functionName,
  };
}`
  );

  fs.writeFileSync(runnerPath, modifiedContent);
  console.log("Modified runner.ts for testing");
}

// Function to restore the original runner.ts file
function restoreRunner() {
  const runnerPath = "src/esbmc/runner.ts";
  const backupPath = `${runnerPath}.bak`;

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, runnerPath);
    fs.unlinkSync(backupPath);
    console.log("Restored original runner.ts");
  }
}

// Function to run the tests
async function runTests() {
  try {
    // Check if act is installed
    if (!checkActInstalled()) {
      console.error(
        'Error: act is not installed. Please install it with "brew install act"'
      );
      return;
    }

    console.log("Starting local test...");

    // Modify runner.ts for testing
    modifyRunnerForTesting();

    // Rebuild the action
    console.log("Building the action...");
    execSync("npm run all", { stdio: "inherit" });

    // Run act
    console.log("Running act...");
    execSync("act push -v", { stdio: "inherit" });

    console.log("Test completed successfully!");
  } catch (error) {
    console.error("Error running tests:", error);
  } finally {
    // Restore original runner.ts
    restoreRunner();
  }
}

// Run the tests
runTests();
