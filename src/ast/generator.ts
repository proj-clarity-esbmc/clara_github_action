import * as path from "path";
import { Logger, runInContainer } from "../utils";

/**
 * Generate AST for a Clarity contract
 * @param clarityFile Path to the Clarity contract file
 * @param containerRepo Container repository for AST generator
 * @param containerVersion Container version
 * @returns Path to the generated AST file
 */
export async function generateAST(
  clarityFile: string,
  containerRepo: string,
  containerVersion: string
): Promise<string> {
  Logger.info(`Generating AST for ${clarityFile}`);

  try {
    // Define the output AST file path
    const astOutputPath = `${clarityFile}.ast`;

    // Run the AST generator container
    await runInContainer(
      containerRepo,
      containerVersion,
      `clarity-ast-generator ${clarityFile} -o ${astOutputPath}`
    );

    Logger.info(`AST generated successfully: ${astOutputPath}`);
    return astOutputPath;
  } catch (error) {
    Logger.error(`Failed to generate AST for ${clarityFile}: ${error}`);
    throw new Error(`AST generation failed for ${clarityFile}: ${error}`);
  }
}

/**
 * Generate ASTs for multiple Clarity contracts
 * @param clarityFiles Array of Clarity contract file paths
 * @param containerRepo Container repository for AST generator
 * @param containerVersion Container version
 * @returns Map of Clarity file paths to AST file paths
 */
export async function generateASTs(
  clarityFiles: string[],
  containerRepo: string,
  containerVersion: string
): Promise<Map<string, string>> {
  Logger.info(`Generating ASTs for ${clarityFiles.length} Clarity contracts`);

  const astMap = new Map<string, string>();

  // Process files sequentially to avoid container conflicts
  for (const file of clarityFiles) {
    try {
      const astPath = await generateAST(file, containerRepo, containerVersion);
      astMap.set(file, astPath);
    } catch (error) {
      Logger.warning(
        `Skipping AST generation for ${file} due to error: ${error}`
      );
    }
  }

  return astMap;
}

/**
 * Get the contract name from a Clarity file path
 * @param clarityFile Path to the Clarity contract file
 * @returns Contract name without extension
 */
export function getContractName(clarityFile: string): string {
  return path.basename(clarityFile, ".clar");
}
