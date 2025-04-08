import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs";
import { ESBMCResult } from "../types";
import { Logger } from "../utils";
import { generateSummary } from "../sarif/converter";

/**
 * Post a comment to a pull request with verification results
 * @param esbmcResults Array of ESBMC verification results
 * @param changedFunctions Map of files to changed functions
 * @returns True if comment was posted successfully
 */
export async function postPRComment(
  esbmcResults: ESBMCResult[],
  changedFunctions: Map<string, string[]>
): Promise<boolean> {
  try {
    // Check if we're in a PR context
    const context = github.context;
    if (!context.payload.pull_request) {
      Logger.info("Not in a pull request context, skipping PR comment");
      return false;
    }

    // Get token from inputs
    const token = core.getInput("github_token");
    if (!token) {
      Logger.warning("No GitHub token provided, skipping PR comment");
      return false;
    }

    // Create octokit client
    const octokit = github.getOctokit(token);

    // Generate summary
    const summary = generateSummary(esbmcResults);

    // Post comment
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: context.payload.pull_request.number,
      body: summary,
    });

    Logger.info("Posted verification results as PR comment");
    return true;
  } catch (error) {
    Logger.error(`Failed to post PR comment: ${error}`);
    return false;
  }
}

/**
 * Upload SARIF report to GitHub Code Scanning
 * @param sarifFile Path to SARIF file
 * @returns True if upload was successful
 */
export async function uploadSARIF(sarifFile: string): Promise<boolean> {
  try {
    // Check if we're in a GitHub Actions context
    if (!process.env.GITHUB_WORKSPACE) {
      Logger.warning("Not in GitHub Actions context, skipping SARIF upload");
      return false;
    }

    // Get token from inputs
    const token = core.getInput("github_token");
    if (!token) {
      Logger.warning("No GitHub token provided, skipping SARIF upload");
      return false;
    }

    // Create octokit client
    const octokit = github.getOctokit(token);

    // Get repository and ref information
    const context = github.context;
    const { owner, repo } = context.repo;
    const ref = context.payload.pull_request?.head.ref || context.ref;

    // Get commit SHA - required for SARIF upload
    const commitSha = context.payload.pull_request?.head.sha || context.sha;

    // Read SARIF file
    const sarifContent = fs.readFileSync(sarifFile, "utf8");
    const sarifBase64 = Buffer.from(sarifContent).toString("base64");

    // Upload SARIF
    await octokit.rest.codeScanning.uploadSarif({
      owner,
      repo,
      commit_sha: commitSha,
      ref,
      sarif: sarifBase64,
    });

    Logger.info(`Uploaded SARIF report to GitHub Code Scanning: ${sarifFile}`);
    return true;
  } catch (error) {
    Logger.error(`Failed to upload SARIF report: ${error}`);
    return false;
  }
}

/**
 * Set the workflow status based on verification results
 * @param esbmcResults Array of ESBMC verification results
 * @param failOnIssue Whether to fail the workflow if issues are found
 */
export function setWorkflowStatus(
  esbmcResults: ESBMCResult[],
  failOnIssue: boolean
): void {
  const hasFailures = esbmcResults.some((r) => !r.verified);

  if (hasFailures) {
    const failureCount = esbmcResults.filter((r) => !r.verified).length;
    const message = `Verification failed for ${failureCount} function(s)`;

    if (failOnIssue) {
      core.setFailed(message);
    } else {
      core.warning(message);
    }
  } else {
    core.info("All functions verified successfully");
  }
}
