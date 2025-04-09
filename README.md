# Clarity Smart Contract Verification GitHub Action

This GitHub Action formally verifies Clarity smart contracts using ESBMC, focusing only on modified functions in pull requests.

## Features

- Automatically detects changed functions in Clarity contracts
- Runs formal verification on modified functions only
- Generates SARIF reports for GitHub Code Scanning
- Posts verification results as PR comments

## Usage

Add the following to your GitHub workflow file:

```yaml
name: Verify Clarity Contracts
on:
  pull_request:
    branches: [main]
    paths:
      - "**.clar"

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required to get full history for detecting changes

      - name: Verify Clarity Contracts
        uses: proj-clarity-esbmc/clara_github_action@v0.1.0-alpha
        with:
          contracts_dir: "./contracts"
          fail_on_issue: "true"

      - name: Upload SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        if: always() && steps.verify.outputs.sarif_report != ''
        with:
          sarif_file: ${{ steps.verify.outputs.sarif_report }}
```

## Inputs

| Input                  | Description                                      | Required | Default                     |
| ---------------------- | ------------------------------------------------ | -------- | --------------------------- |
| `contracts_dir`        | Directory containing Clarity contracts           | No       | `./`                        |
| `esbmc_flags`          | Additional flags to pass to ESBMC                | No       | `--verbose`                 |
| `excluded_contracts`   | Contracts to exclude from verification           | No       | ``                          |
| `fail_on_issue`        | Whether to fail the workflow if issues are found | No       | `true`                      |
| `base_ref`             | Base Git reference for comparison                | No       | Auto-detected in PR context |
| `head_ref`             | Head Git reference for comparison                | No       | Auto-detected in PR context |
| `container_version`    | Version of the container images to use           | No       | `latest`                    |
| `ast_container_repo`   | Container repository for AST generator           | No       | `saad963/esbmc-container`   |
| `esbmc_container_repo` | Container repository for ESBMC                   | No       | `saad963/esbmc-container`   |

## Outputs

| Output                | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `sarif_report`        | Path to the generated SARIF report                         |
| `verification_status` | Overall verification status (success, failure, no_changes) |

## Requirements

- GitHub Actions runner with Docker support
- Access to the container images (public Docker Hub images)
- Git repository with proper history (for detecting changed functions)

## Git Access and Branch Comparison

This action compares branches to detect which functions have changed. To ensure proper operation:

1. Use `actions/checkout@v4` with `fetch-depth: 0` to get full history
2. For pull requests, the action will automatically detect base and head branches
3. For direct pushes, you can specify `base_ref` and `head_ref` inputs

Example checkout configuration:

```yaml
- name: Checkout code
  uses: actions/checkout@v4
  with:
    fetch-depth: 0 # Required for proper branch comparison
```

## License

MIT
