---
name: boxlang-runtime-matchbox
description: "Use this skill when working with MatchBox, the Rust runtime for BoxLang (alongside the JVM runtime): installing it with MVM, running scripts and the REPL, choosing a target (native, js, wasm, wasi, esp32, AWS Lambda preview), the built-in web and app server, bytecode (.bxb), fibers, the tiered JIT, and what differs from BoxLang on the JVM."
---

# MatchBox: the Rust Runtime for BoxLang

> BoxLang is the AI-native software productivity platform for building, modernizing and running applications, with developers and AI agents working together.

## Overview

BoxLang has two runtimes. The JVM runtime is the full platform. **MatchBox** is a Rust implementation that compiles BoxLang to bytecode and runs it on a Rust VM, with no JVM needed for the core runtime. It complements the JVM runtime: use MatchBox where a JVM does not fit (single binaries, the browser, WASI containers, serverless, microcontrollers).

MatchBox is an independent, evolving implementation. Code written for MatchBox generally runs on JVM BoxLang, but MatchBox has a smaller standard library and fewer modules. Check compatibility for your target before promising a feature.

Docs: https://matchbox.boxlang.io  Source: https://github.com/ortus-boxlang/matchbox

---

## Install (use MVM)

Install the MatchBox Version Manager, then a MatchBox version. See the [`matchbox-mvm`](../matchbox-mvm/SKILL.md) skill for everything MVM can do.

```bash
curl -fsSL https://raw.githubusercontent.com/ortus-boxlang/matchbox-quick-installer/main/install/install.sh | bash
mvm install latest && mvm use latest
matchbox --version
```

Docker image: `docker run --rm -v "$PWD:/app" ghcr.io/ortus-boxlang/matchbox:latest my_app.bxs`

---

## Everyday Commands

Run `matchbox --help` for the options of the installed version.

| Command | Purpose |
|---------|---------|
| `matchbox` | Interactive REPL |
| `matchbox app.bxs` | Run a script (the native CLI has the JIT enabled) |
| `matchbox --build app.bxs` | Compile to a `.bxb` bytecode file |
| `matchbox --build --strip-source app.bxs` | Bytecode without embedded source text |
| `matchbox app.bxb` | Run compiled bytecode |
| `matchbox --serve --port 8080 --webroot ./www` | Built-in web server for `.bxm` pages and static files |
| `--output <path>` | Set the output path of a compiled artifact |
| `--module <path>` | Load a BoxLang module directory (repeatable) |
| `--no-shaking`, `--keep <bifs>`, `--no-std-lib` | Control tree-shaking of prelude BIFs |

---

## Targets

| Target | Command | Output | Notes |
|--------|---------|--------|-------|
| native | `matchbox --target native app.bxs` | Executable | Runner stub plus your bytecode, about 500 KB stub, no JVM. See [`compiled-native-binaries`](../runtime-compiled-native-binaries/SKILL.md) |
| js | `matchbox --target js app.bxs` | `.js` + `.wasm` module | Browser and JavaScript hosts, including Cloudflare Workers. See [`wasm-in-the-browser`](../runtime-wasm-in-the-browser/SKILL.md) |
| wasm | `matchbox --target wasm app.bxs` | `.wasm` | Standalone WASM (web) |
| wasi | `matchbox --target wasi app.bxs` | `.wasm` | WASI container binary. See [`wasm-container`](../runtime-wasm-container/SKILL.md) |
| wasi-http | `matchbox --target wasi-http --webroot ./www` | WASI HTTP component | Built from a webroot |
| esp32 | `matchbox --target esp32 --chip esp32s3 app.bxs --flash` | Firmware | Needs the ESP toolchain. Run `matchbox esp32-doctor` first. See [`esp32`](../runtime-esp32/SKILL.md) |
| AWS Lambda | `matchbox lambda deploy Lambda.bx --function <name> --bootstrap <path>` | Lambda function | **Preview.** Deploy currently needs an explicit Linux bootstrap binary. Try locally with `matchbox lambda invoke Lambda.bx --event event.json` |

The Lambda class defines `function run( event, context, response )`.

---

## Web and App Server

- `matchbox --serve` hosts `.bxm` templates and static assets.
- A routed app uses `web.server()` with routes, middleware, static mounts and ColdBox-style handlers. Examples: `docs/examples/app_server` and `docs/examples/websocket_counter` in the MatchBox repo.
- On ESP32 only a lean subset of `web.server()` exists, enabled with `--esp32-web`.

---

## What Is Built In

- **Bytecode VM** with line-number metadata, `.bxb` files, `--strip-source`.
- **Tiered Cranelift JIT**, native CLI only. Four tiers: empty loop elimination, numeric loop bodies, float array iteration, hot function compilation. Native runner stubs, WASM and ESP32 do not include the JIT.
- **Fibers**: a cooperative scheduler behind `runAsync` and non-blocking `sleep` and HTTP.
- **Classes, interfaces, closures**, async futures, `http()` with its own request struct API (see the HTTP guide on the docs site).
- **Native Fusion**: expose Rust functions and classes as BIFs and native objects, in native builds. See [`matchbox-native-fusion`](../matchbox-native-fusion/SKILL.md).
- **Experimental Java interop** (JNI): native builds only, needs a JDK on the host at runtime, no generics or annotations. Do not rely on it.

---

## Differences From BoxLang on the JVM

| Area | BoxLang JVM | MatchBox |
|------|-------------|----------|
| Runtime | JVM | Rust VM, no JVM for the core runtime |
| Standard library and modules | Full | Smaller, growing. Verify each BIF and module you need |
| Java interop | Full | Experimental JNI, native only. None in WASM or ESP32 |
| CFML compatibility | `bx-compat-cfml` | None |
| Targets | Server, CLI, Lambda and more | Adds browser, WASI, ESP32, single binaries |

Test on the real target. A feature that works in `matchbox app.bxs` can be missing in a WASM or ESP32 build.

---

## Checklist

- [ ] Install MVM, then `mvm install latest && mvm use latest`
- [ ] Develop with `matchbox app.bxs`, then build for the target with `--target`
- [ ] Treat AWS Lambda as preview and Java interop as experimental
- [ ] Do not assume a JVM BIF or module exists. Check it on the target
- [ ] Use `--build --strip-source` when shipping bytecode without source text
- [ ] Never promise JIT speedups outside the native CLI
