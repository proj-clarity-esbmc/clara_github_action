# Product Requirements Document (PRD)

**Feature**: GitHub Action template for Clarity Smart Contract Formal Verification.
**Owner**: Company X
**Version**: 1.0
**Date**: April 7, 2025

---

## 1. Overview

### Problem Statement

Developers working with Clarity smart contracts lack an automated, CI/CD-integrated solution to verify code correctness, specifically formal verification of pull requests. This leads to developers skipping or delaying formal verification, increasing the risk of introducing vulnerabilities into production and slowing down the development lifecycle.

### Objective

Create a reusable and easily integrable GitHub Action that:

1. **Efficiently detects** Clarity smart contract files and identifies **specific functions modified** in pull requests or pushed commits.
2. **Executes formal verification** using ESBMC **exclusively on the detected modified functions**, significantly reducing verification time and resource consumption.
3. **Provides clear and actionable feedback** on the verification results directly within the GitHub workflow, including:
   - Generating output in the **SARIF format** for seamless integration with GitHub Code Scanning.
   - Posting **human-readable summaries** of the verification status and any identified issues as pull request comments.
4. **Provides an action template** that can be published to github actions marketplace, which can be used by other clarity smart contracts developers in their repositories
5. Preferred languages are TS & YAML

---

## 2. Key Features

| Feature                    | Description                                                                                                                                                                                                                                                                                                                                          | Priority |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Changed Function Detection | Analyzes the `git diff` between the base and head branches of a pull request (or between commits in a push) to identify Clarity smart contract files (`.clar`) that have been modified. Parses these files to pinpoint the exact functions (including their signatures) that have been added, changed, or potentially deleted (for impact analysis). | P0       |
| Targeted Verification      | Dynamically generates and executes ESBMC commands, specifically targeting only the modified functions identified in the previous step. This significantly optimizes the verification process by avoiding redundant analysis of unchanged code.                                                                                                       | P0       |
| SARIF Reporting            | Converts the raw output from ESBMC into the standardized Static Analysis Results Interchange Format (SARIF). This allows GitHub Code Scanning to ingest the results, display security alerts directly within the GitHub interface (including on code diffs), and track historical findings.                                                          | P0       |
| Customizable Workflow      | Provides flexible input parameters that allow users to:                                                                                                                                                                                                                                                                                              | P1       |
|                            | - Specify the directory(ies) containing Clarity smart contracts (`contracts_dir`).                                                                                                                                                                                                                                                                   |          |
|                            | - Pass custom command-line flags directly to ESBMC (`esbmc_flags`).                                                                                                                                                                                                                                                                                  |          |
|                            | - Define a list of contract file paths or patterns to explicitly exclude from verification (`excluded_contracts`).                                                                                                                                                                                                                                   |          |
|                            | - Configure whether to fail the GitHub Actions workflow if verification issues are found (`fail_on_issue`).                                                                                                                                                                                                                                          |          |
| PR Comment Summaries       | Generates concise and informative comments on the pull request summarizing the outcome of the verification process. This includes:                                                                                                                                                                                                                   | P2       |
|                            | - The overall verification status (e.g., "No issues found," "Potential issues detected").                                                                                                                                                                                                                                                            |          |
|                            | - A brief summary of any identified issues, potentially linking to the SARIF results in Code Scanning for more details.                                                                                                                                                                                                                              |          |
| Configuration File Support | (Consider for future iterations - P3) Allow users to define configuration settings (e.g., ESBMC flags per contract, specific verification properties to check) in a dedicated configuration file within their repository (e.g., `.clarity-verify.yaml`).                                                                                             |          |
| Baseline Comparison        | (Consider for future iterations - P3) Allow the action to compare SARIF reports against a baseline from the main branch to identify new issues introduced by the PR.                                                                                                                                                                                 |          |
| Containerized Execution    | Executes verification in a pre-built Docker container containing ESBMC + Clarity frontend, ensuring consistent environments across runs. Supports version pinning via SHA256 digest.                                                                                                                                                                 | P0       |

---

## 3. User Stories

### 3.1 As a Developer

- **Need**: I want to develop a github action template that automatically verify only the changes I've made to my Clarity smart contracts in a pull request without having to manually run full contract analysis.
- **Acceptance Criteria**:
  - The GitHub Action when added to a repo's action runs automatically when I create or update a pull request targeting the main branch (or other configured branches).
  - Only the Clarity functions I have modified in my current pull request are analyzed by ESBMC.
  - The results of the verification are displayed within the GitHub interface under the "Security" tab in "Code Scanning alerts."
  - If ESBMC finds any potential issues in my changes, I receive notifications and can see the issues highlighted in the code diff of my pull request.

### 3.2 As an Open-Source Maintainer

- **Need**: I want to ensure that contributions to our Clarity smart contract repository do not introduce new safety violations or errors without requiring manual review of every single line of code.
- **Acceptance Criteria**:
  - The GitHub Action automatically triggers on all pull requests submitted to the repository.
  - If the verification process identifies any issues in the contributed code, the GitHub Actions workflow fails, preventing the pull request from being easily merged.
  - Maintainers can see the specific issues reported by ESBMC directly in the pull request, allowing them to provide targeted feedback to contributors.
  - The action provides a clear audit trail of verification results for each pull request.

### 3.3 As a Security Engineer

- **Need**: I need a centralized and standardized way to track the formal verification results of our Clarity smart contracts over time for security audits and compliance purposes.
- **Acceptance Criteria**:
  - The GitHub Action generates SARIF reports that are consistently formatted and can be archived and analyzed.
  - The SARIF reports provide sufficient detail about any identified issues, including the location in the code and the specific ESBMC rule that was violated.
  - The integration with GitHub Code Scanning allows for easy browsing and filtering of historical verification results.

### 3.4 As a DevOps Engineer

- **Need**: I want to ensure the verification environment is consistent, secure, and automatically updated across all our CI/CD pipelines.
- **Acceptance Criteria**:
  - The action executes in a locked-down container image from a trusted registry
  - Container images are regularly scanned for vulnerabilities
  - Clear versioning scheme allows controlled updates
  - Image digests are verifiable to prevent supply chain attacks

---

## 4. Technical Requirements

### 4.1 Core Components

#### 4.1.1. **GitHub Actions Workflow**:

- Triggers: `pull_request` (on `opened`, `synchronize`, `reopened`), `push` (on configured branches, e.g., `main`).
- Reusable via `workflow_call` to allow other workflows to easily incorporate this verification step.
- Should include steps for:
  - Checking out the repository code.
  - Pulling the AST generator container image, from given container repo url
  - Pulling the ESBMC container image with Clarity frontend, from given container repo url
  - Identifying modified Clarity files and functions.
  - Generating AST for each contract containing modified functions
  - Running ESBMC on each identified function one by one.
  - Generating the SARIF report.
  - Uploading the SARIF report to GitHub Code Scanning.
  - (Optional) Posting a summary comment to the pull request.
  - Setting the workflow status based on the verification results.

#### 4.1.2. **Clarity Parser**:

- A robust and reliable mechanism to parse Clarity smart contract files.
- Must accurately identify function definitions (including `define-public`, `define-private`, `define-read-only`) and their boundaries (start and end lines).
- Needs to be able to extract function names and potentially their signatures for targeted ESBMC invocation.
- Consider using existing Clarity parsing libraries if available, or develop a lightweight, focused parser.
- Use following clarity contract as `sample.clar`

```lisp
;; Define the contract's data variables

;; Maps a user's principal address to their deposited amount.
(define-map deposits { owner: principal } { amount: uint })

;; Holds the total amount of deposits in the contract, initialized to 0.
(define-data-var total-deposits uint u0)

;; Public function for users to deposit STX into the contract.

;; Updates their balance and the total deposits in the contract.
(define-public (deposit (amount uint))
   (let (
   ;; Fetch the current balance or default to 0 if none exists.
   (current-balance (default-to u0 (get amount (map-get? deposits { owner: tx-sender })))))
   ;; Transfer the STX from sender = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" to recipient = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.stx-defi (ie: contract identifier on the chain!)".
   (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
   ;; Update the user's deposit amount in the map.
   (map-set deposits { owner: tx-sender } { amount: (+ current-balance amount) })
   ;; Update the total deposits variable.
   (var-set total-deposits (+ (var-get total-deposits) amount))
   ;; Return success.
   (ok true)
   )
)

;; Read-only function to get the total balance
(define-read-only (get-balance)
   (ok (var-get total-deposits))
)
```

- Assume that `(try! (stx-transfer? amount tx-sender (as-contract tx-sender)))` line is changed in function `deposits`

#### 4.1.3. **Clarity AST generation**:

- Pulls Clarity AST generator container from given container repo url.
- Creates AST for all clarity contract with modified functions.
- For now just add a placeholder for this module
- Following is a sample AST output, use it as `sample.clarast`

```JSON
{
  "vars": {
    "variable_declaration": ["total-deposits"],
    "function_declaration": ["get-balance", "deposit"],
    "map_declaration": ["deposits"]
  },
  "identifier": {
    "contract_name": "counter",
    "issuer_principal": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
    "issuer_raw": [
      26,
      [
        109, 120, 222, 123, 6, 37, 223, 191, 193, 108, 58, 138, 87, 53, 246,
        220, 61, 195, 242, 206
      ]
    ]
  },
  "types": [
    ["bool", "bool", "1"],
    ["none", "none", "1"],
    ["principal", "principal", "149"],
    ["uint", "uint_128", "128"],
    ["tuple", "tuple", "1", [["amount", ["uint", "uint_128", "128"]]]],
    ["tuple", "tuple", "1", [["owner", ["principal", "principal", "149"]]]],
    [
      "response",
      "response",
      "2",
      [
        ["bool", "bool", "1"],
        ["uint", "uint_128", "128"]
      ]
    ],
    [
      "response",
      "response",
      "2",
      [
        ["uint", "uint_128", "128"],
        ["none", "none", "1"]
      ]
    ]
  ],
  "expressions": [
    [
      "map",
      {
        "id": 3,
        "type": "map_declaration",
        "span": {
          "end_column": 62,
          "end_line": 4,
          "start_column": 4,
          "start_line": 4
        },
        "identifier": "deposits",
        "cid": 3,
        "objtype": [
          "map",
          "map",
          "1",
          ["tuple", "tuple", "1", [["principal", "owner", "149"]]],
          ["tuple", "tuple", "1", [["uint", "amount", "128"]]]
        ]
      }
    ],
    [
      "data_var",
      {
        "id": 16,
        "type": "variable_declaration",
        "value": {
          "id": 18,
          "type": "lit_uint",
          "span": {
            "end_column": 42,
            "end_line": 7,
            "start_column": 41,
            "start_line": 7
          },
          "identifier": "u0",
          "cid": 18
        },
        "span": {
          "end_column": 43,
          "end_line": 7,
          "start_column": 4,
          "start_line": 7
        },
        "identifier": "total-deposits",
        "cid": 16,
        "objtype": ["uint", "uint_128", "128"]
      }
    ],
    [
      "public",
      {
        "args": [
          {
            "id": 24,
            "type": "function_argument",
            "span": {
              "end_column": 34,
              "end_line": 12,
              "start_column": 29,
              "start_line": 12
            },
            "identifier": "amount",
            "cid": 24,
            "objtype": ["uint", "uint_128", "128"]
          }
        ],
        "id": 22,
        "type": "function_declaration",
        "span": {
          "end_column": 4,
          "end_line": 25,
          "start_column": 4,
          "start_line": 12
        },
        "body": [
          {
            "args": [
              {
                "id": 30,
                "type": "let_variable_declaration",
                "span": {
                  "end_column": 20,
                  "end_line": 15,
                  "start_column": 6,
                  "start_line": 15
                },
                "body": [
                  {
                    "args": [
                      {
                        "id": 33,
                        "type": "lit_uint",
                        "span": {
                          "end_column": 35,
                          "end_line": 15,
                          "start_column": 34,
                          "start_line": 15
                        },
                        "identifier": "u0",
                        "cid": 33
                      },
                      {
                        "args": [
                          {
                            "id": 36,
                            "type": "tuple_key",
                            "span": {
                              "end_column": 47,
                              "end_line": 15,
                              "start_column": 42,
                              "start_line": 15
                            },
                            "identifier": "amount",
                            "cid": 36
                          },
                          {
                            "args": [
                              {
                                "id": 39,
                                "type": "variable",
                                "span": {
                                  "end_column": 66,
                                  "end_line": 15,
                                  "start_column": 59,
                                  "start_line": 15
                                },
                                "identifier": "deposits",
                                "cid": 3
                              },
                              {
                                "args": [
                                  {
                                    "id": 43,
                                    "type": "tuple_key",
                                    "value": {
                                      "id": 44,
                                      "type": "keyword",
                                      "span": {
                                        "end_column": 85,
                                        "end_line": 15,
                                        "start_column": 77,
                                        "start_line": 15
                                      },
                                      "identifier": "tx-sender",
                                      "cid": 44
                                    },
                                    "span": {
                                      "end_column": 74,
                                      "end_line": 15,
                                      "start_column": 70,
                                      "start_line": 15
                                    },
                                    "identifier": "owner",
                                    "cid": 43
                                  }
                                ],
                                "id": 41,
                                "type": "tuple_object",
                                "span": {
                                  "end_column": 0,
                                  "end_line": 0,
                                  "start_column": 0,
                                  "start_line": 0
                                },
                                "identifier": "tuple",
                                "cid": 41
                              }
                            ],
                            "id": 38,
                            "type": "native_function",
                            "span": {
                              "end_column": 57,
                              "end_line": 15,
                              "start_column": 50,
                              "start_line": 15
                            },
                            "identifier": "map-get?",
                            "cid": 38
                          }
                        ],
                        "id": 35,
                        "type": "native_function",
                        "span": {
                          "end_column": 40,
                          "end_line": 15,
                          "start_column": 38,
                          "start_line": 15
                        },
                        "identifier": "get",
                        "cid": 35
                      }
                    ],
                    "id": 32,
                    "type": "native_function",
                    "span": {
                      "end_column": 32,
                      "end_line": 15,
                      "start_column": 23,
                      "start_line": 15
                    },
                    "identifier": "default-to",
                    "cid": 32
                  }
                ],
                "identifier": "current-balance",
                "cid": 30
              }
            ],
            "id": 27,
            "type": "native_function",
            "span": {
              "end_column": 8,
              "end_line": 13,
              "start_column": 6,
              "start_line": 13
            },
            "body": [
              {
                "args": [
                  {
                    "args": [
                      {
                        "id": 49,
                        "type": "variable",
                        "span": {
                          "end_column": 31,
                          "end_line": 17,
                          "start_column": 26,
                          "start_line": 17
                        },
                        "identifier": "amount",
                        "cid": 24
                      },
                      {
                        "id": 50,
                        "type": "keyword",
                        "span": {
                          "end_column": 41,
                          "end_line": 17,
                          "start_column": 33,
                          "start_line": 17
                        },
                        "identifier": "tx-sender",
                        "cid": 50
                      },
                      {
                        "args": [
                          {
                            "id": 53,
                            "type": "keyword",
                            "span": {
                              "end_column": 64,
                              "end_line": 17,
                              "start_column": 56,
                              "start_line": 17
                            },
                            "identifier": "tx-sender",
                            "cid": 53
                          }
                        ],
                        "id": 52,
                        "type": "native_function",
                        "span": {
                          "end_column": 54,
                          "end_line": 17,
                          "start_column": 44,
                          "start_line": 17
                        },
                        "identifier": "as-contract",
                        "cid": 52
                      }
                    ],
                    "id": 48,
                    "type": "native_function",
                    "span": {
                      "end_column": 24,
                      "end_line": 17,
                      "start_column": 12,
                      "start_line": 17
                    },
                    "identifier": "stx-transfer?",
                    "cid": 48
                  }
                ],
                "id": 46,
                "type": "native_function",
                "span": {
                  "end_column": 9,
                  "end_line": 17,
                  "start_column": 6,
                  "start_line": 17
                },
                "identifier": "try!",
                "cid": 46
              },
              {
                "args": [
                  {
                    "id": 56,
                    "type": "variable",
                    "span": {
                      "end_column": 21,
                      "end_line": 19,
                      "start_column": 14,
                      "start_line": 19
                    },
                    "identifier": "deposits",
                    "cid": 3
                  },
                  {
                    "args": [
                      {
                        "id": 60,
                        "type": "tuple_key",
                        "value": {
                          "id": 61,
                          "type": "keyword",
                          "span": {
                            "end_column": 40,
                            "end_line": 19,
                            "start_column": 32,
                            "start_line": 19
                          },
                          "identifier": "tx-sender",
                          "cid": 61
                        },
                        "span": {
                          "end_column": 29,
                          "end_line": 19,
                          "start_column": 25,
                          "start_line": 19
                        },
                        "identifier": "owner",
                        "cid": 60
                      }
                    ],
                    "id": 58,
                    "type": "tuple_object",
                    "span": {
                      "end_column": 0,
                      "end_line": 0,
                      "start_column": 0,
                      "start_line": 0
                    },
                    "identifier": "tuple",
                    "cid": 58
                  },
                  {
                    "args": [
                      {
                        "id": 65,
                        "type": "tuple_key",
                        "value": {
                          "args": [
                            {
                              "id": 68,
                              "type": "variable",
                              "span": {
                                "end_column": 71,
                                "end_line": 19,
                                "start_column": 57,
                                "start_line": 19
                              },
                              "identifier": "current-balance",
                              "cid": 30
                            },
                            {
                              "id": 69,
                              "type": "variable",
                              "span": {
                                "end_column": 78,
                                "end_line": 19,
                                "start_column": 73,
                                "start_line": 19
                              },
                              "identifier": "amount",
                              "cid": 24
                            }
                          ],
                          "id": 67,
                          "type": "native_function",
                          "span": {
                            "end_column": 55,
                            "end_line": 19,
                            "start_column": 55,
                            "start_line": 19
                          },
                          "identifier": "+",
                          "cid": 67
                        },
                        "span": {
                          "end_column": 51,
                          "end_line": 19,
                          "start_column": 46,
                          "start_line": 19
                        },
                        "identifier": "amount",
                        "cid": 65
                      }
                    ],
                    "id": 63,
                    "type": "tuple_object",
                    "span": {
                      "end_column": 0,
                      "end_line": 0,
                      "start_column": 0,
                      "start_line": 0
                    },
                    "identifier": "tuple",
                    "cid": 63
                  }
                ],
                "id": 55,
                "type": "native_function",
                "span": {
                  "end_column": 12,
                  "end_line": 19,
                  "start_column": 6,
                  "start_line": 19
                },
                "identifier": "map-set",
                "cid": 55
              },
              {
                "args": [
                  {
                    "id": 72,
                    "type": "variable",
                    "span": {
                      "end_column": 27,
                      "end_line": 21,
                      "start_column": 14,
                      "start_line": 21
                    },
                    "identifier": "total-deposits",
                    "cid": 16
                  },
                  {
                    "args": [
                      {
                        "args": [
                          {
                            "id": 77,
                            "type": "variable",
                            "span": {
                              "end_column": 54,
                              "end_line": 21,
                              "start_column": 41,
                              "start_line": 21
                            },
                            "identifier": "total-deposits",
                            "cid": 16
                          }
                        ],
                        "id": 76,
                        "type": "native_function",
                        "span": {
                          "end_column": 39,
                          "end_line": 21,
                          "start_column": 33,
                          "start_line": 21
                        },
                        "identifier": "var-get",
                        "cid": 76
                      },
                      {
                        "id": 78,
                        "type": "variable",
                        "span": {
                          "end_column": 62,
                          "end_line": 21,
                          "start_column": 57,
                          "start_line": 21
                        },
                        "identifier": "amount",
                        "cid": 24
                      }
                    ],
                    "id": 74,
                    "type": "native_function",
                    "span": {
                      "end_column": 30,
                      "end_line": 21,
                      "start_column": 30,
                      "start_line": 21
                    },
                    "identifier": "+",
                    "cid": 74
                  }
                ],
                "id": 71,
                "type": "native_function",
                "span": {
                  "end_column": 12,
                  "end_line": 21,
                  "start_column": 6,
                  "start_line": 21
                },
                "identifier": "var-set",
                "cid": 71
              },
              {
                "args": [
                  {
                    "id": 81,
                    "type": "lit_bool",
                    "span": {
                      "end_column": 12,
                      "end_line": 23,
                      "start_column": 9,
                      "start_line": 23
                    },
                    "identifier": "true",
                    "cid": 81
                  }
                ],
                "id": 80,
                "type": "response_expression",
                "span": {
                  "end_column": 7,
                  "end_line": 23,
                  "start_column": 6,
                  "start_line": 23
                },
                "identifier": "ok",
                "cid": 80
              }
            ],
            "identifier": "let",
            "cid": 27
          }
        ],
        "identifier": "deposit",
        "return_type": [
          "response",
          "response",
          "2",
          [
            ["bool", "bool", "1"],
            ["uint", "uint_128", "128"]
          ]
        ],
        "cid": 22
      }
    ],
    [
      "read_only",
      {
        "args": [],
        "id": 85,
        "type": "function_declaration",
        "span": {
          "end_column": 4,
          "end_line": 30,
          "start_column": 4,
          "start_line": 28
        },
        "body": [
          {
            "args": [
              {
                "args": [
                  {
                    "id": 90,
                    "type": "variable",
                    "span": {
                      "end_column": 31,
                      "end_line": 29,
                      "start_column": 18,
                      "start_line": 29
                    },
                    "identifier": "total-deposits",
                    "cid": 16
                  }
                ],
                "id": 89,
                "type": "native_function",
                "span": {
                  "end_column": 16,
                  "end_line": 29,
                  "start_column": 10,
                  "start_line": 29
                },
                "identifier": "var-get",
                "cid": 89
              }
            ],
            "id": 87,
            "type": "response_expression",
            "span": {
              "end_column": 7,
              "end_line": 29,
              "start_column": 6,
              "start_line": 29
            },
            "identifier": "ok",
            "cid": 87
          }
        ],
        "identifier": "get-balance",
        "return_type": [
          "response",
          "response",
          "2",
          [
            ["uint", "uint_128", "128"],
            ["none", "none", "1"]
          ]
        ],
        "cid": 85
      }
    ]
  ],
  "backfill": {},
  "const_values": {
    "deposits": {
      "type": {
        "keytype": ["tuple", "tuple", "1", [["principal", "owner", "149"]]],
        "valtype": ["tuple", "tuple", "1", [["uint", "amount", "128"]]]
      },
      "value": null
    },
    "total-deposits": {
      "type": ["uint", "uint_128", "128"],
      "value": {
        "id": 18,
        "type": "lit_uint",
        "span": {
          "end_column": 42,
          "end_line": 7,
          "start_column": 41,
          "start_line": 7
        },
        "identifier": "u0",
        "cid": 18
      }
    }
  },
  "exported_functions": ["deposit", "get-balance"],
  "globals": {
    "deposit": 22,
    "deposits": 3,
    "get-balance": 85,
    "total-deposits": 16
  },
  "private_functions": [],
  "previous_block": {
    "block-height": "u928575",
    "burn-block-height": "u891469",
    "stacks-block-height": "u928575",
    "stx-liquid-supply": "u1520566748414280"
  },
  "stacks_keywords": {
    "block-height": "u928576",
    "burn-block-height": "u891469",
    "chain-id": "u2147483648",
    "is-in-mainnet": "false",
    "is-in-regtest": "true",
    "stacks-block-height": "u928576",
    "stx-liquid-supply": "u1520566748414280",
    "tenure-height": "u3"
  }
}
```

#### 4.1.4. **ESBMC Integration**:

- Run esbmc on contract ASTs where the functions are modified.
- invoke the esbmc with flags `--clar <clar_contract_file_name> <clarast_file_name> --clar_contract <clar_contract_file_name_without_extension> --force-malloc-success --k-induction --max-k-step 6 --unwind 200 --no-bounds-check --array-flattener --no-unlimited-scanf-check --no-unwinding-assertions --multi-property --function <function_name>`
- Handle different ESBMC output formats and parse the results to identify verification failures and potential issues.
- If the output contains `VERIFICATION FAILED`, then run the following function on output to get the failing function details. This should give a list of failures in function under test.

  ```TS
  function parseFailingFunctions(clarOutput: string): {
    functionName: string;
    lineNumber: number;
    title: string;
    failingCode: string;
  }[] {

    const lines = clarOutput.split("\n");
    const results: {
    functionName: string;
    lineNumber: number;
    title: string;
    failingCode: string;
    }[] = [];

    let inCounterexampleBlock = false;
    let currentFnName: string | undefined;
    let currentLineNumber: number | undefined;

    // regex to match violated property line
    const stateLineRegex =
    /State\s+\d+\s+file\s+.+?\s+line\s+(\d+)\s+function\s+(\S+)\s+thread\s+\d+/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Chck if we are in the counterexample block
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
  ```

#### 4.1.5. **SARIF Generator**:

    - A module or script responsible for transforming the raw ESBMC output into a valid SARIF 2.1.0 JSON structure.
    - Accurately map ESBMC error messages and output locations to the corresponding SARIF `results` properties (e.g., `ruleId`, `message`, `locations`).
    - Define relevant `rules` within the SARIF output based on the types of checks performed by ESBMC.

### 4.2 Inputs/Outputs

| Input                 | Description                                                                                                                                                                                                                                                                              | Default         | Required |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------- |
| `contracts_dir`       | The path to the directory (or directories, separated by commas or newlines) containing your Clarity smart contract files.                                                                                                                                                                | `./`            | No       |
| `esbmc_flags`         | Additional command-line flags to be passed directly to the ESBMC executable. This allows users to customize the verification process (e.g., setting timeouts, enabling specific analyses).                                                                                               | `--verbose`     | No       |
| `excluded_contracts`  | A comma-separated list or newline-separated list of file paths or glob patterns to explicitly exclude certain Clarity contracts from the verification process. This can be useful for utility contracts or contracts known to have issues that are not the focus of the current changes. | ``              | No       |
| `fail_on_issue`       | A boolean value indicating whether the GitHub Actions workflow should fail if any verification issues are reported by ESBMC. Setting this to `true` is recommended for blocking PR merges when potential vulnerabilities are found.                                                      | `true`          | No       |
| `base_ref`            | (Optional, automatically provided in `pull_request` context) The Git reference of the base branch to compare against for identifying changes. Users might need to explicitly provide this in `push` events if they want to compare against a specific older commit.                      | (Contextual)    | No       |
| `head_ref`            | (Optional, automatically provided in `pull_request` context) The Git reference of the head branch (the changes). Automatically provided in `pull_request` events. May need to be the current commit SHA in `push` events.                                                                | (Contextual)    | No       |
| `container_version`   | Specific container version/digest to use.                                                                                                                                                                                                                                                | v1.0.0          | No       |
| Output                | Description                                                                                                                                                                                                                                                                              | Format          |
| `sarif_report`        | The file path to the generated SARIF report containing the formal verification results. This can be used by subsequent steps in the workflow (e.g., uploading to a storage service).                                                                                                     | `results.sarif` |
| `verification_status` | A string indicating the overall status of the verification (e.g., "success", "failure", "no_changes"). This can be used for conditional logic in subsequent workflow steps.                                                                                                              | String          |

### 4.3 Error Handling

- **Failures**: The GitHub Actions workflow should exit with a non-zero exit code if ESBMC reports any verification violations and the `fail_on_issue` input is set to `true`. Clear error messages should be logged to the workflow output.
- **Logging**: Comprehensive debug logs should be generated and stored as workflow artifacts. These logs should include details about the function detection process, the generated ESBMC commands, the raw ESBMC output, and the SARIF generation process. Users should be able to enable more verbose logging if needed.
- **Edge Cases**: Gracefully handle scenarios such as:
  - No Clarity files being found in the specified `contracts_dir`.
  - No modified Clarity functions being detected in the pull request.
  - Errors during the execution of ESBMC.
  - Issues during SARIF report generation.

---
