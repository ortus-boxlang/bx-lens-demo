---
name: boxlang-syntax-check
description: "Use this skill to validate BoxLang and CFML source files for syntax errors without executing them, using the `boxlang check` command: check files or directories after editing code, read text or JSON results, interpret exit codes, and wire syntax checks into agent loops, git hooks, and CI."
---

# BoxLang Syntax Check

> BoxLang is the AI-native software productivity platform for building, modernizing and running applications, with developers and AI agents working together.

## Overview

`boxlang check` parses BoxLang and CFML source files and reports syntax errors
**without executing the code or compiling it to bytecode**. It is the BoxLang
equivalent of `bash -n script.sh` or `node --check file.js`. It uses the same
ANTLR parsers as the runtime, so results match what the runtime will accept.

Use it as a fast, safe feedback step: run it after every edit you make to a
BoxLang or CFML file, before running tests or starting a server.

## When to Use

- After creating or editing any `.bx`, `.bxs`, `.bxm`, `.cfc`, `.cfm`, or `.cfs` file
- Before running the test suite, so parse errors fail fast
- Before committing or opening a pull request
- In git hooks and CI pipelines
- When a runtime error looks like a parse error and you need the exact line and column

## Requirements

The OS (binary) install of BoxLang provides the `boxlang` command. Confirm with:

```bash
boxlang --version
```

## Usage

```bash
boxlang check [OPTIONS] [FILE...]
```

Pass one or more files, a directory with `--source`, or both.

| Option | Description |
|--------|-------------|
| `-h, --help` | Show help and exit |
| `--source <PATH>` | File or directory to check. Directories are scanned recursively for every supported extension |
| `--format <text\|json>` | Output format. Default `text`. Use `json` when you need to parse results |
| `-q, --quiet` | Suppress per-file success output and the summary. Failures are always printed |

Supported extensions: `.bx` `.bxs` `.bxm` `.cfc` `.cfm` `.cfs`

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Every checked file is syntactically valid |
| `1` | One or more files have syntax errors, or a usage error occurred (for example a missing `--source` path) |

## Examples

```bash
# Check specific files
boxlang check models/User.bx handlers/Main.bx

# Check a whole directory recursively
boxlang check --source ./src

# Only print problems (good for hooks)
boxlang check --source ./src --quiet

# Machine readable output
boxlang check --source ./src --format json
```

### Text Output

```
$ boxlang check bad.bxs
❌ bad.bxs
   bad.bxs: Line: 1 Col: 3 - Unclosed parenthesis [(] on line 1
if ( true {
   ^

───────────────────────────────
✅ 0 valid   ❌ 1 invalid   (1 files checked)
```

### JSON Output

`--format json` returns an array with one record per checked file:

```json
[ {
  "file" : "/path/to/bad.bxs",
  "valid" : false,
  "issues" : [ {
    "message" : "Unclosed parenthesis [(] on line 1\nif ( true {\n   ^",
    "line" : 1,
    "column" : 3
  } ]
}, {
  "file" : "/path/to/good.bxs",
  "valid" : true,
  "issues" : [ ]
} ]
```

## Agent Workflow

1. Edit or create the file.
2. Run `boxlang check <file>` (or `--source <dir>` after multi-file changes).
3. If the exit code is `1`, read the `line`, `column`, and `message`, fix the
   file, and run the check again. Repeat until it exits `0`.
4. Only then run tests, start the server, or commit.

Prefer `--format json` when you need to process results programmatically, and
`--quiet` when you only care about failures.

## Pair It With the Formatter

Syntax validity and formatting are separate checks. Run both before finishing:

```bash
boxlang check --source ./src
boxlang format --check --source ./src
```

`boxlang format --check` exits non-zero when formatting drift exists. Run
`boxlang format` (without `--check`) to apply formatting.

## Git Hook Example

`.git/hooks/pre-commit`:

```bash
#!/usr/bin/env bash
boxlang check --source ./src --quiet || {
  echo "Syntax errors found. Commit aborted."
  exit 1
}
```

## CI Example

```yaml
- name: Syntax check
  run: boxlang check --source ./src
```

Run it before the test step so parse errors fail the pipeline early.

## Limitations

- It validates **syntax only**. It does not catch runtime errors, missing
  variables, wrong argument names, or failing logic. Run the tests for those.
- It does not execute or compile code, so it is safe to run on any file.
- A file that passes may still fail at runtime.

## Related

- Documentation: https://boxlang.ortusbooks.com/getting-started/ide-tooling/boxlang-syntax-check
- Skill `boxlang-runtime-cli-scripting` for other CLI action commands
- Skill `boxlang-testing` for running TestBox tests after the syntax check passes
