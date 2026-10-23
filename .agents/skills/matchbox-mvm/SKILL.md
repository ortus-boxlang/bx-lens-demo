---
name: matchbox-mvm
description: "Use this skill when installing or managing MatchBox versions with MVM, the MatchBox Version Manager: the install script, mvm install latest or snapshot, mvm use, per-project .mvmrc pinning, mvm list, mvm doctor, updating MVM, SHA-256 verified downloads, and CI setup."
---

# MVM: the MatchBox Version Manager

> BoxLang is the AI-native software productivity platform for building, modernizing and running applications, with developers and AI agents working together.

## Overview

MVM installs MatchBox releases side by side under `~/.mvm` (override with `MVM_HOME`) and switches between them. It is the recommended way to install MatchBox. MVM is itself a BoxLang program compiled to a native executable by MatchBox.

Source: https://github.com/ortus-boxlang/matchbox-quick-installer

---

## Install MVM

Linux and macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/ortus-boxlang/matchbox-quick-installer/main/install/install.sh | bash
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/ortus-boxlang/matchbox-quick-installer/main/install/install.ps1 | iex
```

The installer defaults to the latest stable MVM. Set `MVM_VERSION` to an exact version to install a snapshot build, for example `MVM_VERSION=2.0.1-snapshot`. It adds MVM to your user PATH and installs shell initialization for Bash, Zsh, Fish or PowerShell, plus Bash completions. **Restart your shell afterwards.**

---

## Install and Use MatchBox

```bash
mvm install latest      # latest stable MatchBox
mvm list                # installed versions
mvm use latest          # activate it
matchbox --version      # confirm
mvm exec --version      # run the active matchbox through mvm
mvm tui                 # interactive version picker
```

| Command | Purpose |
|---------|---------|
| `mvm install latest` | Install the latest stable release |
| `mvm install snapshot` | Install the rolling development build. Running it again refreshes only when the published build ID or revision changed. `--force` reinstalls |
| `mvm install <version>` | Install an exact version |
| `mvm use <version>` | Activate a version (`latest`, `snapshot` or an exact one) |
| `mvm list`, `mvm list-remote`, `mvm current` | Show installed, available and active versions |
| `mvm remove <version>` | Remove an installed version |
| `mvm clean` | Clear temporary downloads, keeps installed versions |
| `mvm update` | Update MVM itself (stable tracks stable, snapshot tracks snapshots) |
| `mvm version` | Show the MVM version, source commit and UTC build time |
| `mvm doctor [--fix]` | Check PATH, shell init and the active install. `--fix` repairs shell init and completions |
| `mvm help` | Full CLI help |

Updating MatchBox itself is `mvm install latest && mvm use latest`.

---

## Pin a Version Per Project

```bash
mvm local latest   # writes .mvmrc in the current directory
mvm use            # with no argument, activates the version in .mvmrc
```

Commit `.mvmrc` so everyone on the project, and CI, use the same MatchBox.

---

## Verified Downloads

A download must have published `version.json` metadata and a matching SHA-256 checksum before it replaces an installation. A failed check leaves the current version in place. Historical releases without that metadata cannot be newly installed. Checksums use `sha256sum` on Linux, `shasum` on macOS and `Get-FileHash` on Windows.

---

## CI

```bash
curl -fsSL https://raw.githubusercontent.com/ortus-boxlang/matchbox-quick-installer/main/install/install.sh | bash
# PATH changes come from shell init, so use a new shell step or source the init script
mvm install latest && mvm use latest
matchbox --version
```

Pin an exact version in CI for reproducible builds. Prefer `snapshot` only when testing unreleased work.

---

## Checklist

- [ ] Use MVM instead of the older direct install script
- [ ] Restart the shell after installing MVM, or run `mvm doctor --fix`
- [ ] Pin the project version with `mvm local <version>` and commit `.mvmrc`
- [ ] Use `mvm install snapshot` only for pre-release testing
- [ ] If `matchbox` is not found, run `mvm doctor`
