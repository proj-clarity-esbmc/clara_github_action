/**
 * Types for the Clarity Smart Contract Verification Action
 */

/**
 * Represents a function in a Clarity smart contract
 */
export interface ClarityFunction {
  name: string;
  type: "define-public" | "define-private" | "define-read-only";
  startLine: number;
  endLine: number;
  content: string;
  file: string;
}

/**
 * Represents a changed function detected in a pull request
 */
export interface ChangedFunction extends ClarityFunction {
  changeType: "added" | "modified" | "deleted";
}

/**
 * Represents the result of an ESBMC verification run
 */
export interface ESBMCResult {
  verified: boolean;
  failures: FailureDetails[];
  rawOutput: string;
  clarityFile: string;
  functionName: string;
}

/**
 * Details of a verification failure
 */
export interface FailureDetails {
  functionName: string;
  lineNumber: number;
  title: string;
  failingCode: string;
}

/**
 * Configuration for the action
 */
export interface ActionConfig {
  contractsDir: string[];
  esbmcFlags: string;
  excludedContracts: string[];
  failOnIssue: boolean;
  baseRef: string;
  headRef: string;
  containerVersion: string;
  astContainerRepo: string;
  esbmcContainerRepo: string;
}

/**
 * SARIF Report structure (simplified)
 */
export interface SARIFReport {
  version: string;
  $schema: string;
  runs: SARIFRun[];
}

/**
 * SARIF Run structure
 */
export interface SARIFRun {
  tool: {
    driver: {
      name: string;
      version: string;
      rules: SARIFRule[];
    };
  };
  results: SARIFResult[];
}

/**
 * SARIF Rule structure
 */
export interface SARIFRule {
  id: string;
  shortDescription: {
    text: string;
  };
  helpText?: {
    text: string;
  };
}

/**
 * SARIF Result structure
 */
export interface SARIFResult {
  ruleId: string;
  message: {
    text: string;
  };
  locations: {
    physicalLocation: {
      artifactLocation: {
        uri: string;
      };
      region: {
        startLine: number;
        startColumn?: number;
      };
    };
  }[];
}
