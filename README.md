# Clarity Smart Contract Verification GitHub Action

A GitHub Action for formal verification of Clarity smart contracts using ESBMC, focusing only on modified functions in pull requests.

## Features

- **Changed Function Detection**: Analyzes git diffs to identify modified Clarity functions
- **Targeted Verification**: Only verifies functions that have been modified
- **SARIF Reporting**: Generates SARIF reports for GitHub Code Scanning
- **PR Comments**: Posts verification results as comments on pull requests
- **Customizable Workflow**: Configurable inputs for different verification needs
- **Containerized Execution**: Uses Docker containers for consistent verification environments

## Usage

Add the following to your GitHub workflow file:

```yaml
- name: Verify Clarity Contracts
  uses: companyx/clarity-verify-action@v1
  with:
    contracts_dir: "./contracts"
    fail_on_issue: "true"
    github_token: ${{ secrets.GITHUB_TOKEN }}

- name: Upload SARIF to GitHub Code Scanning
  uses: github/codeql-action/upload-sarif@v2
  if: always() # Run even if verification fails
  with:
    sarif_file: ${{ steps.verify.outputs.sarif_report }}
```

## Inputs

| Input                | Description                                                                                                                                                                                                                                                                              | Default      | Required |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------- |
| `contracts_dir`      | The path to the directory (or directories, separated by commas or newlines) containing your Clarity smart contract files.                                                                                                                                                                | `./`         | No       |
| `esbmc_flags`        | Additional command-line flags to be passed directly to the ESBMC executable. This allows users to customize the verification process (e.g., setting timeouts, enabling specific analyses).                                                                                               | `--verbose`  | No       |
| `excluded_contracts` | A comma-separated list or newline-separated list of file paths or glob patterns to explicitly exclude certain Clarity contracts from the verification process. This can be useful for utility contracts or contracts known to have issues that are not the focus of the current changes. | ``           | No       |
| `fail_on_issue`      | A boolean value indicating whether the GitHub Actions workflow should fail if any verification issues are reported by ESBMC. Setting this to `true` is recommended for blocking PR merges when potential vulnerabilities are found.                                                      | `true`       | No       |
| `base_ref`           | (Optional, automatically provided in `pull_request` context) The Git reference of the base branch to compare against for identifying changes. Users might need to explicitly provide this in `push` events if they want to compare against a specific older commit.                      | (Contextual) | No       |
| `head_ref`           | (Optional, automatically provided in `pull_request` context) The Git reference of the head branch (the changes). Automatically provided in `pull_request` events. May need to be the current commit SHA in `push` events.                                                                | (Contextual) | No       |
| `container_version`  | Specific container version/digest to use.                                                                                                                                                                                                                                                | v1.0.0       | No       |

## Outputs

| Output                | Description                                                                                                                                                                          | Format          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| `sarif_report`        | The file path to the generated SARIF report containing the formal verification results. This can be used by subsequent steps in the workflow (e.g., uploading to a storage service). | `results.sarif` |
| `verification_status` | A string indicating the overall status of the verification (e.g., "success", "failure", "no_changes"). This can be used for conditional logic in subsequent workflow steps.          | String          |

## Testing Locally

You can test this GitHub Action locally using the provided test script and the [Act](https://github.com/nektos/act) tool.

### Prerequisites

1. Install Act:

   ```bash
   # macOS
   brew install act
   ```

2. Make sure Docker is running on your system.

### Testing Steps

1. Clone this repository:

   ```bash
   git clone https://github.com/companyx/clarity-verify-action.git
   cd clarity-verify-action
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the test script:

   ```bash
   node test-local.js
   ```

   This script will:

   - Check if Act is installed
   - Modify the runner.ts file for testing
   - Build the action
   - Run Act to test the action
   - Restore the original runner.ts file

4. Alternatively, you can run the tests manually:

   ```bash
   # Build the mock Docker containers
   docker build -t ghcr.io/companyx/clarity-ast-generator:v1.0.0 -f Dockerfile.mock-ast .
   docker build -t ghcr.io/companyx/clarity-esbmc:v1.0.0 -f Dockerfile.mock-esbmc .

   # Build the action
   npm run all

   # Run Act
   act push -v
   ```

## License

MIT
