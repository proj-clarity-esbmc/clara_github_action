import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as fs from "fs";
import * as path from "path";

/**
 * Logger utility for consistent logging
 */
export class Logger {
  static debug(message: string): void {
    core.debug(message);
  }

  static info(message: string): void {
    core.info(message);
  }

  static warning(message: string): void {
    core.warning(message);
  }

  static error(message: string): void {
    core.error(message);
  }

  static group(name: string): void {
    core.startGroup(name);
  }

  static endGroup(): void {
    core.endGroup();
  }
}

/**
 * Execute a command in a Docker container
 * @param image Docker image to use
 * @param tag Image tag or digest
 * @param command Command to execute
 * @param workDir Working directory to mount
 * @returns Command output
 */
export async function runInContainer(
  image: string,
  tag: string,
  command: string,
  workDir: string = process.cwd()
): Promise<string> {
  const imageRef = `${image}:${tag}`;
  Logger.debug(`Running command in container ${imageRef}: ${command}`);

  let output = "";
  let errorOutput = "";

  const options: exec.ExecOptions = {
    cwd: workDir,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
      stderr: (data: Buffer) => {
        errorOutput += data.toString();
      },
    },
  };

  const dockerCommand = `docker run --rm -v "${workDir}:${workDir}" -w "${workDir}" ${imageRef} ${command}`;

  try {
    await exec.exec("sh", ["-c", dockerCommand], options);
    return output;
  } catch (error) {
    Logger.error(`Error running command in container: ${errorOutput}`);
    throw new Error(`Failed to run command in container: ${error}`);
  }
}

/**
 * Check if a file exists
 * @param filePath Path to the file
 * @returns True if the file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

/**
 * Read a file and return its contents
 * @param filePath Path to the file
 * @returns File contents
 */
export function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error}`);
  }
}

/**
 * Write content to a file
 * @param filePath Path to the file
 * @param content Content to write
 */
export function writeFile(filePath: string, content: string): void {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, "utf8");
  } catch (error) {
    throw new Error(`Failed to write to file ${filePath}: ${error}`);
  }
}

/**
 * Find all files matching a pattern in a directory
 * @param dir Directory to search
 * @param pattern File pattern to match (e.g., "*.clar")
 * @returns Array of file paths
 */
export function findFiles(dir: string, pattern: string): string[] {
  try {
    const files: string[] = [];
    const regex = new RegExp(pattern.replace(".", "\\.").replace("*", ".*"));

    function scanDir(currentDir: string) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && regex.test(entry.name)) {
          files.push(fullPath);
        }
      }
    }

    scanDir(dir);
    return files;
  } catch (error) {
    Logger.error(`Error finding files in ${dir}: ${error}`);
    return [];
  }
}

/**
 * Check if a path matches any of the patterns
 * @param filePath Path to check
 * @param patterns Array of glob patterns
 * @returns True if the path matches any pattern
 */
export function matchesAnyPattern(
  filePath: string,
  patterns: string[]
): boolean {
  return patterns.some((pattern) => {
    const regex = new RegExp(
      pattern.replace(/\./g, "\\.").replace(/\*/g, ".*")
    );
    return regex.test(filePath);
  });
}

/**
 * Helper function to check if a line is a filler line (empty or just whitespace)
 * @param line Line to check
 * @returns True if the line is a filler line
 */
export function isFillerLine(line: string): boolean {
  return line.trim() === "";
}

/**
 * Parse a comma or newline separated string into an array
 * @param value String to parse
 * @returns Array of trimmed values
 */
export function parseListInput(value: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}
