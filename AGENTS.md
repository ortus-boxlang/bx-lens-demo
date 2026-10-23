# AGENTS.md — bx-lens-demo

Demo application that exercises every feature of **BxLens**, the BoxLang debug bar and console. It is a BoxLang (not CFML) application built on the MiniServer, with a ColdBox sub-app (`app/cbApp`) and a Lensy AI assistant.

## Project layout

| Path | What it is |
|---|---|
| `app/` | Web root. Templated pages are `.bxm` files; one page per BxLens feature (N+1 queries, slow queries, errors, cache, forms, sessions, mail, ORM, CFML legacy, etc.) |
| `app/Application.bx` | App descriptor (session, mappings, schedulers, interceptors) |
| `app/cbApp/` | Embedded ColdBox application (routing, handlers, views, modules) |
| `app/api/`, `app/models/`, `app/ormmodels/`, `app/schedulers/`, `app/spans/`, `app/concurrency/` | Handlers, models, ORM entities, scheduled tasks, trace spans, scenario threads |
| `app/boxlang_modules/` | Installed modules (`bx-lens`, `bx-ai`, `bx-derby`, `bx-compat-cfml`, ...) — treat as vendored; do not edit by hand |
| `modules/demoLens/` | Demo-only local module (copied into `app/boxlang_modules` by `start.sh`) |
| `config/` | `boxlang.json` (MiniServer) and `boxlang.commandbox.json` (CommandBox engine config) |
| `mock-smtp/`, `drop/`, `.run/` | SMTP sink for the Mail page, local BxLens zip drop, run artifacts |
| `test/smoke.sh` | Smoke test against a running server |
| `box.json` / `server.json` | Module deps and CommandBox server settings |
| `start.sh` | Main entry point: installs modules, starts SMTP sink + MiniServer on port 8088 (`WITH_AI=1` starts Ollama via Docker Compose) |
| `docker-compose.yml` / `Dockerfile` | Containerized demo + Ollama |

## Running & verifying

- Start the demo: `./start.sh` (needs BoxLang/MiniServer on PATH and Java 21+). Console at `http://localhost:8088/~bxlens/index.bxm` (admin `lens-demo`, viewer `lens-view`).
- CommandBox alternative: `box install && box server start`.
- **Always syntax-check BoxLang code after editing** with `boxlang check` before declaring work done.
- Smoke test: `./test/smoke.sh` against a running instance.
- Scenarios hold threads/connections and can use up to 40% of the heap — never run them next to anything important, and press "Reset all" when done.

## Conventions

- BoxLang syntax and file types (`.bx`, `.bxm`), tab-indented aligned code, `argumentCollection="true"` passthroughs — follow the `boxlang-best-practices` and `ortus-coding-standards` skills.
- Queries go through `queryExecute` with `params` (never string interpolation); the demo deliberately contains vulnerable pages (`xss.bxm`, injection examples) — keep those labeled as demo-only.
- New pages are `.bxm` templates registered in the control panel at `app/index.bxm`.

## Skills — `.agents/skills/`

This project ships a full library of BoxLang/ColdBox skills in `.agents/skills/<name>/SKILL.md`. **Before writing or reviewing code in a given domain, read the matching SKILL.md and follow its links.** Each skill's `SKILL.md` is the entry point; resolve relative paths inside skills against that skill's directory.

Key skills by task:

- **Writing/reviewing any BoxLang code**: `boxlang-best-practices`, `ortus-coding-standards`, `boxlang-language-fundamentals`, `boxlang-syntax-check` (use `boxlang check`), `boxlang-code-reviewer`
- **Web app / templates / app descriptor**: `boxlang-web-development`, `boxlang-application-descriptor`, `boxlang-templating`, `boxlang-interceptors`
- **This demo's heavy domains**: `boxlang-database-access` (queries, transactions, `bx-derby`), `boxlang-async-programming` + `boxlang-scheduled-tasks` (scenarios, executors, `app/schedulers`), `boxlang-caching` + `cachebox-standalone` (cache pages), `boxlang-file-handling`, `boxlang-security` (XSS/injection examples), `boxlang-modules-and-packages` + `boxlang-configuration` (module setup, `config/boxlang.json`)
- **ColdBox sub-app (`app/cbApp`)**: `coldbox-handler-development`, `coldbox-routing-development`, `coldbox-event-model`, `coldbox-request-context`, `coldbox-di`, `coldbox-configuration`, `coldbox-view-rendering`, `coldbox-cache-integration`, `coldbox-logging` (or `logbox`), `coldbox-rest-api-development`, `coldbox-flash-messaging`, `coldbox-scheduled-tasks`, `coldbox-sse-streaming`, `coldbox-ai-integration` (Lensy / `bx-ai`), plus the matching `coldbox-testing-*` skills and `coldbox-reviewer` for tests
- **WireBox/CacheBox internals**: `wirebox-di`, `wirebox-aop`, `cachebox-standalone`
- **CFML legacy pages (`app/legacy`)**: `boxlang-cfml-migration` (`bx-compat-cfml`)
- **Deployment/runtime**: `boxlang-runtime-miniserver`, `boxlang-runtime-commandbox`, `boxlang-runtime-docker`, `boxlang-deployment`, `boxlang-runtime-github-actions`
- **Documentation**: `boxlang-code-documenter`, `boxlang-docbox`
- **Testing**: `boxlang-testing` (TestBox), `bx-playwright-testing` for browser tests

If a task touches a domain not listed, browse `.agents/skills/` — there are 80+ skills covering classes/OOP, functional programming, Java integration, JSR-223, MatchBox, zip, DB migrations, and more.
