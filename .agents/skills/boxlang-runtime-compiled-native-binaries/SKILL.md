---
name: boxlang-runtime-compiled-native-binaries
description: "Use this skill when compiling BoxLang scripts to standalone native executables with MatchBox's --target native flag, shipping them (containers, GitHub release builds), understanding binary size and what a native build includes, and when to reach for Native Fusion Rust interop."
---

# BoxLang Compiled Native Binaries

> BoxLang is the AI-native software productivity platform for building, modernizing and running applications, with developers and AI agents working together.

## Overview

`matchbox --target native` compiles BoxLang to bytecode and appends it to a small pre-built **runner stub** (about 500 KB, VM core only). At startup the stub finds the bytecode at the end of its own file and runs it. The result is one file with no JVM and no MatchBox install needed on the destination.

Install MatchBox with MVM first: see [`matchbox-mvm`](../matchbox-mvm/SKILL.md).

---

## Build and Run

```bash
matchbox app.bxs                    # test first, interpreted (JIT on in the native CLI)
matchbox --target native app.bxs    # produces ./app  (app.exe on Windows)
./app
```

Useful options (`matchbox --help` lists all of them for your version):

| Option | Effect |
|--------|--------|
| `--output <path>` | Set the output file path |
| `--strip-source` | Remove embedded source text. Errors still report file and line, and native binaries read snippets from disk |
| `--no-shaking`, `--keep <bifs>`, `--no-std-lib` | Control tree-shaking of the prelude BIFs |

Native binaries are platform specific. The JIT is **not** included in the runner stub, so a deployed binary runs on the interpreter.

---

## Cross-Platform Builds

The released `matchbox` CLI embeds runner stubs for several platforms. For release artifacts, build on a runner per platform (GitHub Actions matrix) and verify each binary on its own OS. Check `matchbox --help` for the platform options available in your installed version rather than assuming flags.

```yaml
# .github/workflows/release.yml (shape only, one job per OS)
jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - name: Install MVM and MatchBox
        run: |
          curl -fsSL https://raw.githubusercontent.com/ortus-boxlang/matchbox-quick-installer/main/install/install.sh | bash
          # MVM adds itself to PATH through shell init. Open a new shell, or source the init script it prints.
          mvm install latest && mvm use latest
      - name: Build
        run: matchbox --target native app.bxs
```

Windows runners use `install.ps1` instead of the shell script. Confirm the PATH handling on your runner image before relying on it.

---

## Native Fusion (Rust interop)

Put Rust files in a `native/` directory next to `app.bxs` and the same `matchbox --target native app.bxs` command compiles them together with the VM into one binary. Native Fusion is native-only (not WASM or ESP32), and these builds go through cargo, so they are larger and slower to build than the plain stub. Full reference: [`matchbox-native-fusion`](../matchbox-native-fusion/SKILL.md).

```rust
// native/math.rs
use matchbox_vm::{matchbox_fn, types::BxNativeFunction};
use std::collections::HashMap;

#[matchbox_fn]
pub fn add( a: f64, b: f64 ) -> f64 { a + b }

pub fn register_bifs() -> HashMap<String, BxNativeFunction> {
	let mut map = HashMap::new();
	map.insert( "add".to_string(), add_wrapper as BxNativeFunction );
	map
}
```

```js
// app.bxs
println( add( 10, 20 ) ); // 30
```

---

## Distribution Patterns

```dockerfile
# Static-friendly binaries can ship in a minimal image. Verify the binary's libc needs first.
FROM debian:stable-slim
COPY app /app
ENTRYPOINT ["/app"]
```

A `FROM scratch` image only works if the binary has no dynamic library needs. Test it. When in doubt, use a slim base image.

---

## Checklist

- [ ] Test with `matchbox app.bxs` before `--target native`
- [ ] Remember the runner stub has no JIT
- [ ] Build each platform on its own runner and test the artifact there
- [ ] Use `--strip-source` if you do not want source text in the binary
- [ ] Use Native Fusion only for hot paths or Rust crates, in native builds
- [ ] Never claim Java interop in native builds is stable. It is experimental and needs a JDK
