import * as path from "path";
import { ESBMCResult, SARIFReport, SARIFRule, SARIFResult } from "../types";
import { Logger, writeFile } from "../utils";

/**
 * Define SARIF rules based on ESBMC verification checks
 * @returns Array of SARIF rules
 */
function defineRules(): SARIFRule[] {
  return [
    {
      id: "clarity-verify-assertion",
      shortDescription: {
        text: "Assertion failure in Clarity contract",
      },
      helpText: {
        text: "An assertion in the Clarity contract failed during formal verification.",
      },
    },
    {
      id: "clarity-verify-overflow",
      shortDescription: {
        text: "Arithmetic overflow in Clarity contract",
      },
      helpText: {
        text: "An arithmetic operation in the Clarity contract may cause an overflow.",
      },
    },
    {
      id: "clarity-verify-underflow",
      shortDescription: {
        text: "Arithmetic underflow in Clarity contract",
      },
      helpText: {
        text: "An arithmetic operation in the Clarity contract may cause an underflow.",
      },
    },
    {
      id: "clarity-verify-division-by-zero",
      shortDescription: {
        text: "Division by zero in Clarity contract",
      },
      helpText: {
        text: "A division operation in the Clarity contract may cause a division by zero.",
      },
    },
    {
      id: "clarity-verify-execution-error",
      shortDescription: {
        text: "Execution error in Clarity contract",
      },
      helpText: {
        text: "An error occurred during the execution of the Clarity contract.",
      },
    },
    {
      id: "clarity-verify-unknown-error",
      shortDescription: {
        text: "Unknown error in Clarity contract",
      },
      helpText: {
        text: "An unknown error occurred during the verification of the Clarity contract.",
      },
    },
  ];
}

/**
 * Map ESBMC failure title to SARIF rule ID
 * @param title ESBMC failure title
 * @returns SARIF rule ID
 */
function mapTitleToRuleId(title: string): string {
  const titleMap: Record<string, string> = {
    assertion: "clarity-verify-assertion",
    "arithmetic overflow": "clarity-verify-overflow",
    "arithmetic underflow": "clarity-verify-underflow",
    "division by zero": "clarity-verify-division-by-zero",
    "execution-error": "clarity-verify-execution-error",
  };

  return titleMap[title] || "clarity-verify-unknown-error";
}

/**
 * Convert ESBMC results to SARIF results
 * @param esbmcResults Array of ESBMC results
 * @returns Array of SARIF results
 */
function convertToSARIFResults(esbmcResults: ESBMCResult[]): SARIFResult[] {
  const sarifResults: SARIFResult[] = [];

  for (const result of esbmcResults) {
    if (!result.verified) {
      for (const failure of result.failures) {
        const ruleId = mapTitleToRuleId(failure.title);

        sarifResults.push({
          ruleId,
          message: {
            text: `Verification failed in function '${failure.functionName}': ${failure.failingCode}`,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: {
                  uri: result.clarityFile,
                },
                region: {
                  startLine: failure.lineNumber > 0 ? failure.lineNumber : 1,
                  startColumn: 1,
                },
              },
            },
          ],
        });
      }
    }
  }

  return sarifResults;
}

/**
 * Generate SARIF report from ESBMC results
 * @param esbmcResults Array of ESBMC results
 * @returns SARIF report
 */
export function generateSARIF(esbmcResults: ESBMCResult[]): SARIFReport {
  Logger.info("Generating SARIF report from ESBMC results");

  const sarifReport: SARIFReport = {
    version: "2.1.0",
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "ESBMC Clarity Formal Verification",
            version: "1.0.0",
            rules: defineRules(),
          },
        },
        results: convertToSARIFResults(esbmcResults),
      },
    ],
  };

  return sarifReport;
}

/**
 * Write SARIF report to file
 * @param sarifReport SARIF report
 * @param outputPath Output file path
 * @returns Path to the generated SARIF file
 */
export function writeSARIFReport(
  sarifReport: SARIFReport,
  outputPath: string = "results.sarif"
): string {
  Logger.info(`Writing SARIF report to ${outputPath}`);

  try {
    writeFile(outputPath, JSON.stringify(sarifReport, null, 2));
    return outputPath;
  } catch (error) {
    Logger.error(`Failed to write SARIF report: ${error}`);
    throw new Error(`Failed to write SARIF report: ${error}`);
  }
}

/**
 * Generate summary of verification results
 * @param esbmcResults Array of ESBMC results
 * @returns Summary text
 */
export function generateSummary(esbmcResults: ESBMCResult[]): string {
  const totalFunctions = esbmcResults.length;
  const verifiedFunctions = esbmcResults.filter((r) => r.verified).length;
  const failedFunctions = totalFunctions - verifiedFunctions;

  let summary = `# Clarity Smart Contract Verification Summary\n\n`;
  summary += `- Total functions verified: ${totalFunctions}\n`;
  summary += `- Successfully verified: ${verifiedFunctions}\n`;
  summary += `- Verification failed: ${failedFunctions}\n\n`;

  if (failedFunctions > 0) {
    summary += `## Failed Verifications\n\n`;

    for (const result of esbmcResults) {
      if (!result.verified) {
        summary += `### Function: \`${
          result.functionName
        }\` in \`${path.basename(result.clarityFile)}\`\n\n`;

        for (const failure of result.failures) {
          summary += `- **${failure.title}** at line ${
            failure.lineNumber > 0 ? failure.lineNumber : "unknown"
          }\n`;
          summary += `  \`${failure.failingCode}\`\n\n`;
        }
      }
    }
  } else {
    summary += `All functions were successfully verified! 🎉\n`;
  }

  return summary;
}
