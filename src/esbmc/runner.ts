// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as path from "path";
import { ESBMCResult, FailureDetails } from "../types";
import { Logger, runInContainer, isFillerLine } from "../utils";
import { getContractName } from "../ast/generator";

/**
 * Run ESBMC on a specific function in a Clarity contract
 * @param clarityFile Path to the Clarity contract file
 * @param astFile Path to the AST file
 * @param functionName Name of the function to verify
 * @param esbmcFlags Additional ESBMC flags
 * @param containerRepo Container repository for ESBMC
 * @param containerVersion Container version
 * @returns ESBMC verification result
 */
export async function runESBMC(
  clarityFile: string,
  astFile: string,
  functionName: string,
  esbmcFlags: string,
  containerRepo: string,
  containerVersion: string
): Promise<ESBMCResult> {
  Logger.info(`Running ESBMC on function ${functionName} in ${clarityFile}`);

  try {
    // Get contract name without extension
    const contractName = getContractName(clarityFile);

    // Prepare ESBMC command
    const esbmcCmd = [
      `--clar ${clarityFile} ${astFile}`,
      `--clar_contract ${contractName}`,
      `--force-malloc-success --k-induction --max-k-step 6 --unwind 200`,
      `--no-bounds-check --array-flattener --no-unlimited-scanf-check`,
      `--no-unwinding-assertions --multi-property --function ${functionName}`,
      esbmcFlags,
    ].join(" ");

    // Run ESBMC in container
    const output = await runInContainer(
      containerRepo,
      containerVersion,
      esbmcCmd
    );

    // Parse output
    return parseESBMCOutput(output, clarityFile, functionName);
  } catch (error) {
    Logger.error(`ESBMC execution failed for ${functionName}: ${error}`);
    return {
      verified: false,
      failures: [
        {
          functionName,
          lineNumber: -1,
          title: "execution-error",
          failingCode: `ESBMC execution failed: ${error}`,
        },
      ],
      rawOutput: `Error: ${error}`,
      clarityFile,
      functionName,
    };
  }
}

/**
 * Parse ESBMC output to determine verification result
 * @param output ESBMC output
 * @param clarityFile Path to the Clarity contract file
 * @param functionName Name of the function
 * @returns ESBMC verification result
 */
export function parseESBMCOutput(
  output: string,
  clarityFile: string,
  functionName: string
): ESBMCResult {
  if (output.includes("VERIFICATION SUCCESSFUL")) {
    return {
      verified: true,
      failures: [],
      rawOutput: output,
      clarityFile,
      functionName,
    };
  }

  if (output.includes("VERIFICATION FAILED")) {
    const failures = parseFailingFunctions(output);
    return {
      verified: false,
      failures,
      rawOutput: output,
      clarityFile,
      functionName,
    };
  }

  // If output doesn't contain either success or failure message
  return {
    verified: false,
    failures: [
      {
        functionName,
        lineNumber: -1,
        title: "unknown-result",
        failingCode: "ESBMC did not produce a clear verification result",
      },
    ],
    rawOutput: output,
    clarityFile,
    functionName,
  };
}

/**
 * Parse failing functions from ESBMC output
 * @param clarOutput ESBMC output
 * @returns Array of failure details
 */
export function parseFailingFunctions(clarOutput: string): FailureDetails[] {
  const lines = clarOutput.split("\n");
  const results: FailureDetails[] = [];

  let inCounterexampleBlock = false;
  let currentFnName: string | undefined;
  let currentLineNumber: number | undefined;

  // regex to match violated property line
  const stateLineRegex =
    /State\s+\d+\s+file\s+.+?\s+line\s+(\d+)\s+function\s+(\S+)\s+thread\s+\d+/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if we are in the counterexample block
    if (line === "[Counterexample]") {
      inCounterexampleBlock = true;
      continue;
    }

    if (inCounterexampleBlock) {
      // see if it is a state line
      const match = line.match(stateLineRegex);
      if (match) {
        // get line number and function name
        currentLineNumber = parseInt(match[1], 10);
        currentFnName = match[2];
        continue;
      }

      // check for violated property section
      if (line.startsWith("Violated property:")) {
        // Move to next lines and skip filler lines
        i++;
        let nextLine = (lines[i] || "").trim();
        while (i < lines.length && isFillerLine(nextLine)) {
          i++;
          nextLine = (lines[i] || "").trim();
        }

        // Now 'nextLine' should be the 'title' (e.g. 'assertion')
        const title = nextLine || "unknown-property";
        // Move to the next line again, skip filler if needed
        i++;
        let codeLine = (lines[i] || "").trim();
        while (i < lines.length && isFillerLine(codeLine)) {
          i++;
          codeLine = (lines[i] || "").trim();
        }

        // 'codeLine' should be the failing code
        const failingCode = codeLine || "unknown-failing-code";

        results.push({
          functionName: currentFnName ?? "unknown_function",
          lineNumber: currentLineNumber ?? -1,
          title,
          failingCode,
        });
        inCounterexampleBlock = false;
      }
    }
  }
  return results;
}

/**
 * Run ESBMC on multiple functions
 * @param changedFunctions Map of Clarity files to function names
 * @param astMap Map of Clarity files to AST files
 * @param esbmcFlags Additional ESBMC flags
 * @param containerRepo Container repository for ESBMC
 * @param containerVersion Container version
 * @returns Array of ESBMC verification results
 */
export async function runESBMCOnFunctions(
  changedFunctions: Map<string, string[]>,
  astMap: Map<string, string>,
  esbmcFlags: string,
  containerRepo: string,
  containerVersion: string
): Promise<ESBMCResult[]> {
  const results: ESBMCResult[] = [];

  // Process each file and its functions
  for (const [clarityFile, functions] of changedFunctions.entries()) {
    const astFile = astMap.get(clarityFile);

    if (!astFile) {
      Logger.warning(
        `No AST file found for ${clarityFile}, skipping verification`
      );
      continue;
    }

    // Verify each function
    for (const functionName of functions) {
      try {
        const result = await runESBMC(
          clarityFile,
          astFile,
          functionName,
          esbmcFlags,
          containerRepo,
          containerVersion
        );

        results.push(result);
      } catch (error) {
        Logger.error(`Failed to verify function ${functionName}: ${error}`);

        // Add error result
        results.push({
          verified: false,
          failures: [
            {
              functionName,
              lineNumber: -1,
              title: "verification-error",
              failingCode: `Error during verification: ${error}`,
            },
          ],
          rawOutput: `Error: ${error}`,
          clarityFile,
          functionName,
        });
      }
    }
  }

  return results;
}
