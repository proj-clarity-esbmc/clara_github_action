import * as core from "@actions/core";
import * as github from "@actions/github";
import * as path from "path";
import { ActionConfig, ChangedFunction } from "./types";
import { Logger, parseListInput } from "./utils";
import { detectChangedFunctions } from "./parser/function-detector";
import { generateASTs } from "./ast/generator";
import { runESBMC } from "./esbmc/runner";
import { generateSARIF, writeSARIFReport } from "./sarif/converter";
import {
  postPRComment,
  uploadSARIF,
  setWorkflowStatus,
} from "./github/comment";

/**
 * Main function to run the GitHub Action
 */
async function run(): Promise<void> {
  try {
    Logger.info("Starting Clarity Smart Contract Verification");

    // Get inputs
    const config = getActionConfig();
    Logger.info(`Configuration: ${JSON.stringify(config, null, 2)}`);

    // 1. Detect changed functions
    const changedFunctions = await detectChangedFunctions(
      config.baseRef,
      config.headRef,
      config.contractsDir,
      config.excludedContracts
    );

    if (changedFunctions.length === 0) {
      Logger.info("No modified Clarity functions detected.");
      core.setOutput("verification_status", "no_changes");
      return;
    }

    Logger.info(`Detected ${changedFunctions.length} changed functions`);

    // Group changed functions by file
    const changedFunctionsByFile = groupFunctionsByFile(changedFunctions);

    // 2. Generate ASTs for contracts with changed functions
    const astMap = await generateASTs(
      Array.from(changedFunctionsByFile.keys()),
      config.astContainerRepo,
      config.containerVersion
    );

    // 3. Run ESBMC on each changed function
    const esbmcResults = [];
    for (const [file, functions] of changedFunctionsByFile.entries()) {
      const astFile = astMap.get(file);
      if (!astFile) {
        Logger.warning(`No AST file found for ${file}, skipping verification`);
        continue;
      }

      for (const func of functions) {
        try {
          const result = await runESBMC(
            file,
            astFile,
            func,
            config.esbmcFlags,
            config.esbmcContainerRepo,
            config.containerVersion
          );
          esbmcResults.push(result);
        } catch (error) {
          Logger.error(`Failed to verify function ${func}: ${error}`);
        }
      }
    }

    // 4. Generate SARIF report
    const sarifReport = generateSARIF(esbmcResults);
    const sarifPath = writeSARIFReport(sarifReport);
    core.setOutput("sarif_report", sarifPath);

    // 5. Upload SARIF to GitHub Code Scanning
    await uploadSARIF(sarifPath);

    // 6. Post PR comment if in PR context
    if (github.context.payload.pull_request) {
      await postPRComment(esbmcResults, changedFunctionsByFile);
    }

    // 7. Set verification status
    const hasFailures = esbmcResults.some((r) => !r.verified);
    core.setOutput("verification_status", hasFailures ? "failure" : "success");

    // 8. Fail if issues found and fail_on_issue is true
    setWorkflowStatus(esbmcResults, config.failOnIssue);

    Logger.info("Clarity Smart Contract Verification completed");
  } catch (error) {
    core.setFailed(`Action failed: ${error}`);
  }
}

/**
 * Get action configuration from inputs
 * @returns Action configuration
 */
function getActionConfig(): ActionConfig {
  const contractsDir = parseListInput(core.getInput("contracts_dir") || "./");
  const esbmcFlags = core.getInput("esbmc_flags") || "--verbose";
  const excludedContracts = parseListInput(
    core.getInput("excluded_contracts") || ""
  );
  const failOnIssue = core.getInput("fail_on_issue") !== "false";
  const containerVersion = core.getInput("container_version") || "v1.0.0";
  const astContainerRepo =
    core.getInput("ast_container_repo") ||
    "ghcr.io/companyx/clarity-ast-generator";
  const esbmcContainerRepo =
    core.getInput("esbmc_container_repo") || "ghcr.io/companyx/clarity-esbmc";

  // Get base and head refs
  let baseRef = core.getInput("base_ref");
  let headRef = core.getInput("head_ref");

  // If not provided, try to get from context
  if (!baseRef && github.context.payload.pull_request) {
    baseRef = github.context.payload.pull_request.base.ref;
  }

  if (!headRef && github.context.payload.pull_request) {
    headRef = github.context.payload.pull_request.head.ref;
  }

  // Default to main and HEAD if still not available
  if (!baseRef) baseRef = "main";
  if (!headRef) headRef = "HEAD";

  return {
    contractsDir,
    esbmcFlags,
    excludedContracts,
    failOnIssue,
    baseRef,
    headRef,
    containerVersion,
    astContainerRepo,
    esbmcContainerRepo,
  };
}

/**
 * Group changed functions by file
 * @param changedFunctions Array of changed functions
 * @returns Map of files to function names
 */
function groupFunctionsByFile(
  changedFunctions: ChangedFunction[]
): Map<string, string[]> {
  const functionsByFile = new Map<string, string[]>();

  for (const func of changedFunctions) {
    if (!functionsByFile.has(func.file)) {
      functionsByFile.set(func.file, []);
    }
    functionsByFile.get(func.file)!.push(func.name);
  }

  return functionsByFile;
}

// Run the action
run().catch((error) => {
  core.setFailed(`Unhandled error: ${error}`);
});
