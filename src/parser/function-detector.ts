import * as path from "path";
import { exec } from "@actions/exec";
import { ClarityFunction, ChangedFunction } from "../types";
import { Logger, readFile } from "../utils";

/**
 * Get the content of a file at a specific Git reference
 * @param gitRef Git reference (branch, tag, commit)
 * @param filePath Path to the file
 * @returns File content
 */
export async function getFileContent(
  gitRef: string,
  filePath: string
): Promise<string> {
  let content = "";

  try {
    const options = {
      listeners: {
        stdout: (data: Buffer) => {
          content += data.toString();
        },
      },
    };

    await exec("git", ["show", `${gitRef}:${filePath}`], options);
    return content;
  } catch (error) {
    Logger.warning(
      `Failed to get content for ${filePath} at ${gitRef}: ${error}`
    );
    return "";
  }
}

/**
 * Get modified files between two Git references
 * @param baseRef Base Git reference
 * @param headRef Head Git reference
 * @param contractsDir Directories to search for contracts
 * @returns Array of modified file paths
 */
export async function getModifiedFiles(
  baseRef: string,
  headRef: string,
  contractsDir: string[]
): Promise<string[]> {
  let output = "";

  try {
    const options = {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
      },
    };

    // Get diff between base and head
    await exec("git", ["diff", "--name-only", baseRef, headRef], options);

    // Filter files by directory and extension
    const files = output
      .split("\n")
      .map((file) => file.trim())
      .filter((file) => file.endsWith(".clar"))
      .filter((file) => {
        // Check if file is in one of the contract directories
        return contractsDir.some((dir) => {
          const relativePath = path.relative(dir, file);
          return (
            !relativePath.startsWith("..") && !path.isAbsolute(relativePath)
          );
        });
      });

    return files;
  } catch (error) {
    Logger.error(`Failed to get modified files: ${error}`);
    return [];
  }
}

/**
 * Parse Clarity functions from a file content
 * @param content File content
 * @param filePath Path to the file
 * @returns Array of Clarity functions
 */
export function parseClarityFunctions(
  content: string,
  filePath: string
): ClarityFunction[] {
  const functions: ClarityFunction[] = [];
  const lines = content.split("\n");

  // Regular expressions for function definitions
  const functionRegex = /\(define-(public|private|read-only)\s+\(([^)]+)/;

  let inFunction = false;
  let currentFunction: Partial<ClarityFunction> = {};
  let openParens = 0;
  let functionContent = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inFunction) {
      // Check if line contains a function definition
      const match = line.match(functionRegex);
      if (match) {
        inFunction = true;
        openParens = 1; // Count the opening parenthesis of the define

        currentFunction = {
          type: match[1] as
            | "define-public"
            | "define-private"
            | "define-read-only",
          name: match[2].trim().split(" ")[0], // Extract function name
          startLine: i + 1,
          file: filePath,
          content: line,
        };

        functionContent = line;

        // Count additional opening parentheses in the current line
        for (let j = match.index! + 1; j < line.length; j++) {
          if (line[j] === "(") openParens++;
          if (line[j] === ")") openParens--;
        }

        // If function definition is complete in a single line
        if (openParens === 0) {
          inFunction = false;
          currentFunction.endLine = i + 1;
          currentFunction.content = functionContent;
          functions.push(currentFunction as ClarityFunction);
        }
      }
    } else {
      // Already inside a function, continue collecting content
      functionContent += "\n" + line;

      // Count parentheses to determine when the function ends
      for (let j = 0; j < line.length; j++) {
        if (line[j] === "(") openParens++;
        if (line[j] === ")") openParens--;
      }

      // If all parentheses are closed, the function is complete
      if (openParens === 0) {
        inFunction = false;
        currentFunction.endLine = i + 1;
        currentFunction.content = functionContent;
        functions.push(currentFunction as ClarityFunction);
      }
    }
  }

  return functions;
}

/**
 * Compare functions from base and head to identify changes
 * @param baseFunctions Functions from base branch
 * @param headFunctions Functions from head branch
 * @returns Array of changed functions
 */
export function compareAndIdentifyChanges(
  baseFunctions: ClarityFunction[],
  headFunctions: ClarityFunction[]
): ChangedFunction[] {
  const changedFunctions: ChangedFunction[] = [];

  // Find modified and deleted functions
  for (const baseFunc of baseFunctions) {
    const headFunc = headFunctions.find((f) => f.name === baseFunc.name);

    if (!headFunc) {
      // Function was deleted
      changedFunctions.push({
        ...baseFunc,
        changeType: "deleted",
      });
    } else if (baseFunc.content !== headFunc.content) {
      // Function was modified
      changedFunctions.push({
        ...headFunc,
        changeType: "modified",
      });
    }
  }

  // Find added functions
  for (const headFunc of headFunctions) {
    const baseFunc = baseFunctions.find((f) => f.name === headFunc.name);

    if (!baseFunc) {
      // Function was added
      changedFunctions.push({
        ...headFunc,
        changeType: "added",
      });
    }
  }

  return changedFunctions;
}

/**
 * Detect changed functions in Clarity contracts
 * @param baseRef Base Git reference
 * @param headRef Head Git reference
 * @param contractsDir Directories containing Clarity contracts
 * @param excludedContracts Contracts to exclude
 * @returns Array of changed functions
 */
export async function detectChangedFunctions(
  baseRef: string,
  headRef: string,
  contractsDir: string[],
  excludedContracts: string[]
): Promise<ChangedFunction[]> {
  Logger.info("Detecting changed Clarity functions...");

  // Get modified files
  const modifiedFiles = await getModifiedFiles(baseRef, headRef, contractsDir);

  // Filter out excluded contracts
  const filteredFiles = modifiedFiles.filter((file) => {
    return !excludedContracts.some((pattern) => {
      const regex = new RegExp(
        pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")
      );
      return regex.test(file);
    });
  });

  Logger.info(`Found ${filteredFiles.length} modified Clarity files`);

  // Detect changed functions in each file
  const changedFunctions: ChangedFunction[] = [];

  for (const file of filteredFiles) {
    Logger.debug(`Analyzing changes in ${file}`);

    // Get file content from base and head
    const baseContent = await getFileContent(baseRef, file);
    const headContent = await getFileContent(headRef, file);

    // If file is new, all functions are added
    if (!baseContent) {
      const headFunctions = parseClarityFunctions(headContent, file);
      changedFunctions.push(
        ...headFunctions.map((func) => ({
          ...func,
          changeType: "added" as const,
        }))
      );
      continue;
    }

    // If file is deleted, all functions are deleted
    if (!headContent) {
      const baseFunctions = parseClarityFunctions(baseContent, file);
      changedFunctions.push(
        ...baseFunctions.map((func) => ({
          ...func,
          changeType: "deleted" as const,
        }))
      );
      continue;
    }

    // Parse functions from both versions
    const baseFunctions = parseClarityFunctions(baseContent, file);
    const headFunctions = parseClarityFunctions(headContent, file);

    // Compare functions to identify changes
    const changes = compareAndIdentifyChanges(baseFunctions, headFunctions);
    changedFunctions.push(...changes);
  }

  Logger.info(`Detected ${changedFunctions.length} changed functions`);
  return changedFunctions;
}
