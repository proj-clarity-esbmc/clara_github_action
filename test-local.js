const fs = require("fs");
const { execSync } = require("child_process");
const path = require("path");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

// Function to log with colors
function log(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  switch (type) {
    case "success":
      console.log(`${colors.green}[${timestamp}] ✓ ${message}${colors.reset}`);
      break;
    case "warning":
      console.log(`${colors.yellow}[${timestamp}] ⚠ ${message}${colors.reset}`);
      break;
    case "error":
      console.log(`${colors.red}[${timestamp}] ✗ ${message}${colors.reset}`);
      break;
    case "info":
    default:
      console.log(`${colors.cyan}[${timestamp}] ℹ ${message}${colors.reset}`);
      break;
  }
}

// Function to check if act is installed
function checkActInstalled() {
  try {
    execSync("act --version", { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to check if git is initialized
function checkGitInitialized() {
  try {
    execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to initialize git if not already initialized
function initializeGitIfNeeded() {
  if (!checkGitInitialized()) {
    log("Git repository not initialized. Initializing...");
    execSync("git init && git branch -m master main", { stdio: "inherit" });
    execSync("git add .", { stdio: "inherit" });
    execSync('git commit -m "Initial commit"', { stdio: "inherit" });
    log("Git repository initialized with main branch", "success");
    return true;
  }
  log("Git repository already initialized", "info");
  return false;
}

// Function to create test commits if needed
function createTestCommitIfNeeded() {
  try {
    // Check if we already have multiple commits
    const commitCount = execSync("git rev-list --count HEAD").toString().trim();

    if (parseInt(commitCount) < 2) {
      log("Creating test commit with changes to Clarity contract...");
      execSync(
        'sed -i "" "s/(define-read-only (get-balance)/(define-read-only (get-balance) ;; Modified function/" test-contracts/sample.clar'
      );
      execSync("git add test-contracts/sample.clar");
      execSync('git commit -m "Modify get-balance function"');
      log("Test commit created", "success");
      return true;
    }

    log("Multiple commits already exist", "info");
    return false;
  } catch (error) {
    log(`Error creating test commit: ${error.message}`, "error");
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
  log("Modified runner.ts for testing", "success");
}

// Function to restore the original runner.ts file
function restoreRunner() {
  const runnerPath = "src/esbmc/runner.ts";
  const backupPath = `${runnerPath}.bak`;

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, runnerPath);
    fs.unlinkSync(backupPath);
    log("Restored original runner.ts", "success");
  }
}

// Function to run the tests
async function runTests() {
  try {
    log("Starting local test for Clarity Smart Contract Verification Action");
    log("---------------------------------------------------------------");

    // Check if act is installed
    if (!checkActInstalled()) {
      log(
        'Error: act is not installed. Please install it with "brew install act"',
        "error"
      );
      return;
    }

    // Initialize git if needed
    initializeGitIfNeeded();

    // Create test commit if needed
    createTestCommitIfNeeded();

    // Modify runner.ts for testing
    modifyRunnerForTesting();

    // Rebuild the action
    log("Building the action...");
    execSync("npm run all", { stdio: "inherit" });

    // Run act with improved options
    log("Running act...");
    execSync("act push -v", { stdio: "inherit" });

    log("Test completed successfully!", "success");
  } catch (error) {
    log(`Error running tests: ${error.message}`, "error");
    console.error(error);
  } finally {
    // Restore original runner.ts
    restoreRunner();
  }
}

// Run the tests
runTests();
