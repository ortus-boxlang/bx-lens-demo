# BxLens demo

A demo application for [BxLens](https://github.com/ortus-solutions-private/bx-lens), the BoxLang debug bar and console. Every page produces one kind of data that BxLens can show, so you can demo each feature, and ask **Lensy**, the Box Agent for your server, about it.

It has two kinds of pages:

- **Request pages** (N+1 queries, slow queries, caught and uncaught errors, HTTP calls, cache, forms, sessions, CFML) show up in the **bar** at the bottom of the page and in the console.
- **Scenarios** run real threads, locks, connections and memory on the JVM: a deadlock, lock contention, a saturated executor, an exhausted connection pool, a memory leak, GC pressure, a thread leak and CPU burn. Each has a **Start** and a **Reset** button, so you can run the same story again.

The control panel at `/` lists everything, says what to look at in BxLens, and has **Reset all**.

> **Scenarios are real.** They hold threads, connections and up to 40 percent of the heap on the JVM that runs the demo. Run the demo on a machine you do not mind stressing, never next to anything else, and press **Reset all** when you finish.

## Quick start

Install BoxLang and MiniServer first with the [BoxLang Quick Installer](https://boxlang.ortusbooks.com/getting-started/installation/boxlang-quick-installer) or [BVM](https://boxlang.ortusbooks.com/getting-started/installation/boxlang-version-manager-bvm). These provide the `boxlang`, `install-bx-module`, and MiniServer commands. The demo script does not install or download BoxLang, MiniServer, or web support. You need Java 21 or later.

### 1. MiniServer script (Linux and macOS)

```bash
git clone https://github.com/ortus-boxlang/bx-lens-demo
cd bx-lens-demo
./start.sh
```

The script checks that BoxLang is available, changes into `app/`, and installs `bx-lens`, `bx-ai`, `bx-derby`, `bx-compat-cfml`, `bx-plus`, `bx-orm` and `bx-mail` into `app/boxlang_modules/` with `install-bx-module --local`. It also copies the demo-only `demoLens` module locally, starts a small SMTP sink on port 2525 for the Mail page, and launches the installed MiniServer with `app/` as its web root. Runtime settings are supplied using MiniServer's `--configPath` argument. If BoxLang is missing, install it with the Quick Installer or BVM and rerun the script.

| | |
|---|---|
| Demo | <http://localhost:8088> |
| Console | <http://localhost:8088/~bxlens/index.bxm> |
| Console password | `lens-demo` (admin) and `lens-view` (viewer) |

Options, all environment variables:

| Variable | Default | What it does |
|---|---|---|
| `PORT`, `HOST` | `8088`, `127.0.0.1` | Where to listen |
| `WITH_AI` | | Set to `1` to start local Ollama using Docker Compose, pull the configured models, and turn Lensy on (see [Lensy](#lensy-and-ollama)); requires Docker Compose |
| `MOCK_SMTP_PORT` | `2525` | Port of the SMTP sink |
| `OLLAMA_URL`, `OLLAMA_MODEL` | `http://localhost:11434`, `llama3.2` | Where Lensy finds its model |

### 2. Docker

Starts the demo, an Ollama server, and pulls a tool-calling model for Lensy.

```bash
cp /path/to/bx-lens.zip drop/        # until BxLens is published, or set LENS_VERSION instead
LENS_ZIP=/demo/drop/bx-lens.zip docker compose up --build
```

This runs the containerized demo, Ollama, and model puller. For the local MiniServer workflow above, `start.sh` only starts the Ollama service and pulls the configured models through Docker Compose when you set `WITH_AI=1`; BoxLang/MiniServer remain installed on your host.

### 3. CommandBox

```bash
box install
box server start
```

`server.json` selects BoxLang, uses `config/boxlang.commandbox.json` and installs the modules. Use `/~bxlens/index.bxm` for the console. The `demoLens` module panel and SMTP sink are started by `start.sh`; on CommandBox, start the sink yourself with `boxlang mock-smtp/smtp.bxs` and install `bx-orm` and `bx-mail` if needed.

## BoxLang+ and Lensy

BxLens is free with limits. Lensy, task actions, cache actions, heap dumps, longer history and saving to disk need **BoxLang+** or a trial. For a public demo, activate a license once:

```bash
export BX_LICENSE_EMAIL="you@example.com"
export BX_LICENSE_KEY="..."
./start.sh activate
```

This runs `module:plus activate` against the BoxLang installation selected by your Quick Installer or BVM setup.

### Lensy and Ollama

Lensy uses a model through `bx-ai`. The demo is set up for a local [Ollama](https://ollama.com), so nothing leaves your machine.

```bash
WITH_AI=1 ./start.sh
```

With `WITH_AI=1`, the script starts the `ollama` service from `docker-compose.yml` and runs the model-pull service, which fetches `OLLAMA_MODEL` and `nomic-embed-text`. Docker Compose is required. The two `ollama pull` commands above are only needed if you run Ollama yourself instead; in that case set `OLLAMA_URL` if it is not `http://localhost:11434`. Open the console, **AI** page, and press **Test connection**. A larger model answers harder questions better.

## Ten minute showcase

Open the demo, start the console in another tab (<http://localhost:8088/~bxlens/index.bxm>, log in with `lens-demo`). Keep the bar closed until you need it.

| # | Do this | Show |
|---|---|---|
| 1 | Open **Orders** (`/orders.bxm`) | The collapsed strip is green: status, time, memory, SQL and template counts. Open the bar and walk the **Timeline**, **Queries**, **Messages and Timers** |
| 2 | Open **N+1** | The strip turns amber. Click the issues chip. Queries tab: one statement repeated, with the line that ran it. Console **Requests**: the same request with issues |
| 3 | Open **Error catalog**, click a few `500` and `200` links, including `secret` | Console **Errors**: grouped by cause, several samples under one group, the password and URL credentials hidden |
| 4 | Open **Traffic generator**, press Start | Console **Overview** and **Reports**: rate, p95, p99, status codes, busiest and slowest URLs |
| 5 | **Executors**, press *Saturate demo-pool*, then *Light load* | Console **Executors**: `demo-pool` critical with a queue, `demo-workers` healthy. Ask Lensy: *how are the executors doing? what size should demo-pool have?* |
| 6 | **Deadlock**, press *Start (Java locks)* | Console **System**: deadlock banner naming both threads. **Threads**: both waiting. Ask Lensy: *are there any deadlocks?* Press Reset |
| 7 | **Pool exhaustion**, press Start, then *Run a query* | The query waits 2 seconds and fails. Console **Datasources**: 5 of 5 active, timeouts. **Errors**: the timeout. Reset |
| 8 | **Memory growth**, *Leak 256 MB* a few times, then **GC pressure** Start | Console **System**: heap climbs and stays up, GC count and time grow. Ask Lensy about garbage collection |
| 9 | Open **Scheduled tasks** | Console **Tasks**: healthy, failing, slow, overlapping and paused tasks |
| 10 | Ask Lensy: *diagnose this server* | A health sweep that pulls it together. Press **Reset all** on the control panel |

## Scenario guide

Pages are listed with how to trigger them and what to look for. Every page also prints a **Where to look in BxLens** box.

### Concurrency (start and reset)

| Page | Trigger | In BxLens | Ask Lensy |
|---|---|---|---|
| `/concurrency/deadlock.bxm` | *Start (Java locks)* resets instantly. *Start (named bx:lock)* uses `bx:lock` like `cflock` and clears itself after 90 seconds | **System** banner, **Threads** (`demo-deadlock-A` and `B`), **Overview** | Are there any deadlocks? Which threads are blocked and by what? |
| `/concurrency/lock-contention.bxm` | *Start*, then *Try the lock* (fails after 2 s) or *Wait forever* | **Threads** (`demo-lock-waiter-1` to `5` blocked behind `demo-lock-holder`), **In flight**, **Errors** | Which threads are blocked? |
| `/concurrency/executors.bxm` | *Saturate demo-pool*, *Light load*, *Burst* | **Executors**: pool and queue use, health notes, the 60 second chart | How are the executors? What pool size should I use? |

### Datasources, memory and CPU (start and reset)

| Page | Trigger | In BxLens | Ask Lensy |
|---|---|---|---|
| `/runtime/pool-exhaustion.bxm` | *Start* holds all 5 connections, *Run a query* then times out | **Datasources**, **Errors**, **Queries** (failures) | How are the datasources? Why do queries time out? |
| `/runtime/memory-leak.bxm` | *Leak 64 MB* or *256 MB*, capped at 40 percent of max heap | **System**: heap, memory pools. *Run GC* does not free it | Is there a memory problem? |
| `/runtime/gc-pressure.bxm` | *Start* (60 s) | **System**: GC count and time climb while heap stays flat | What does garbage collection look like? |
| `/runtime/thread-leak.bxm` | *Start* (25 threads) | **Threads** (`demo-leak-N`), **System** thread count | How many threads are there? |
| `/runtime/cpu-spin.bxm` | *Start* (2 threads), or *Spin in this request* | **In flight** with a live stack in the loop, **Threads** CPU column, **System** CPU | Which threads use the most CPU? |

### The bar (one request each)

| Page | Shows |
|---|---|
| `/orders.bxm` | Healthy page: joined query, `lensMeasure`, cache `getOrSet`, messages |
| `/n-plus-one.bxm`, `/slow.bxm`, `/query-error.bxm` | N+1, a slow query (critical), a failed statement |
| `/caught-exception.bxm`, `/error.bxm` | A caught exception (the bar opens on Issues), an uncaught error (kept in Requests as 500) |
| `/http.bxm`, `/http-loop.bxm` | One 200 and one 404, then 22 calls to one endpoint and a failed connection |
| `/cache.bxm`, `/cache-churn.bxm` | Hits and misses, then a low hit rate on the **Caches** page |
| `/timers.bxm`, `/functions.bxm` | `lensStart`, `lensMeasure`, `lensDump`, nested functions |
| `/forms.bxm`, `/session.bxm`, `/xss.bxm` | Password and token redaction, markup shown as text |
| `/transaction.bxm`, `/extend.bxm` | Committed and rolled back transactions, custom panels with `lensPanel()` |
| `/api/orders.json.bxm`, `/events.bxm` | JSON and SSE: recorded in Requests, no bar |
| `/spans/*` | Interrupted spans: exception through an include, uncaught in a function, a thread that outlives the request, timeout, abort, streaming, an 80 second hang for **In flight** |

### Errors, logs, tasks, traffic

| Page | Shows |
|---|---|
| `/errors/index.bxm` | Nine error types, caught (200) or uncaught (500). `app` changes its message each time and still groups as one cause. `secret` proves redaction |
| `/logging.bxm` | One line at every level in `application.log` and `demo.log`, and a flood option for the live tail |
| `/tasks.bxm` | The `demoScheduler`: `refresh-stats` healthy, `sync-prices` failing, `nightly-report` slow, `export-orders` overlapping, `warm-cache` paused, plus `ai-mcp-heartbeat`. The heartbeat calls tools on two local MCP servers every 15 seconds and intentionally fails every seventh cycle; with `WITH_AI=1`, it also runs one of three Ollama-backed agents every fourth cycle. Tasks start with the first request to the app |
| `/traffic.bxm` | A browser side generator with a weighted mix of pages, 404s and 500s |

### Integrations

Both are on in the demo and use their own modules.

| Page | Shows |
|---|---|
| `/orm.bxm` | `bx-orm` entities. *Save a book and flush* inserts and flushes, *Fail an insert* makes a flush fail (title longer than its column). BxLens shows the Hibernate SQL with an ORM label in **Queries**, and with BoxLang+ the **ORM** page with flushes, failures and statistics. Needs `bx-orm` 1.7.2 or later |
| `/mail.bxm` | Eleven `bx:mail` scenarios sent to the SMTP sink: text, HTML, hostile HTML (scripts and a tracking pixel the preview must not run), multipart, inline image, attachment with bcc, refused recipient, slow server, spooled, bounced and a loop of 25. A failover button sends through an app whose first SMTP server is down. BxLens shows them on the **Mail** page. The sink keeps what it accepted in `.run/inbox.log` |

BxLens listens to the `onMail` events of `bx-mail`. **No `bx-mail` release announces them yet**, so the messages may be sent while the Mail page stays empty. Install a `bx-mail` build that announces those events when one is available.

### AI agents and MCP workload

`bx-ai` is installed locally with the other app modules. Application startup registers two small MCP servers at `/~bxai/mcp.bxm?server=bxLensMetrics` and `/~bxai/mcp.bxm?server=bxLensOperations`; their tools return synthetic metrics, order and shipping data, and emit demo log events. The `ai-mcp-heartbeat` scheduler calls those tools every 15 seconds and intentionally generates an MCP/tool failure every seventh cycle. This produces ongoing MCP, scheduler, logging and error activity without requiring a model.

Set `WITH_AI=1` to enable the three Ollama-backed agents as well. The scheduler runs an agent every fourth heartbeat, rotating through metrics, order and cross-server operations analysis. These model calls require Ollama and the configured model, so may take several seconds; by default only the MCP workload runs. The workload is intentionally demo-only and does not place real orders or contact external services.

### ColdBox app

`app/cbApp` is a real ColdBox application, generated with `coldbox create app skeleton=boxlang` (the BoxLang template) and extended. Open it at
<http://localhost:8088/cbApp/> (it forwards to `/cbApp/public/index.bxm`). It has its own datasource (`cbdemo`, in memory Derby), seeded at start from
JSON fixtures in `resources/data` (40 customers, 30 products, 300 orders, 921 order lines).

Its home page lists every scenario with what it does and where to look in BxLens. They cover what you debug in a ColdBox app:

| Group | Scenarios |
|---|---|
| Queries | N+1 with plain SQL, the joined fix, a slow and a heavy report, bad SQL, a Quick lazy relationship N+1 and its `with()` fix, a `qb` query and a `qb` failure |
| Slow ColdBox | A slow handler, query, view (300 partials), nested partials, layout, helper, model start (3 s in `onDIComplete`), interceptor and HTTP call. Event and view caching, a cache miss storm, a `runEvent` chain, sequential against parallel work, a big JSON payload, a lock wait and a framework reinit |
| Errors | Handler, view, layout, model, helper, SQL, WireBox (missing dependency, circular, failing init), nested `runEvent`, a failing interceptor listener, CacheBox, a missing view and layout, validation (422), 404s and JSON API errors. Add `?caught=1` to any of them to catch the error in the handler and send it to the bar |
| Everyday pages and an API | Lists, details, a form that writes, a RESTful `api/v1/orders` (200, 404, 422, 500), random data from `cbmockdata` |
| Custom modules | `reports`, `inventory`, `audit` and `faults` (see below) |

**Modules.** `cbvalidation`, `cbmessagebox`, `route-visualizer`, `qb`, `quick` and `cbmockdata`, plus ColdBox itself and TestBox. They are **not** in git: `start.sh` checks that the `bx-cli` module (BoxLang CommandBox) is installed with `install-bx-module --list`, offers to install it if not, then runs `box install` in `app/cbApp`, which downloads everything into `app/cbApp/lib`. The versions are pinned in `app/cbApp/box.json`; change one and run `box install` again. The ColdBox debugger (`cbdebugger`) is deliberately not installed, so BxLens is the only debugger in the picture.
The four custom modules in `app/modules` each have handlers, views, models and their own scheduler:

| Module | What it does |
|---|---|
| `reports` | A dashboard, a slow report build and a CSV export |
| `inventory` | Stock levels, a reservation that fails with a 409, a slow sync, a slow singleton |
| `audit` | An interceptor that records every request and every created order |
| `faults` | **A fault injector for live demos.** Switch on injected latency, errors or both at a rate you choose, watch the p95 and error rate move in BxLens, then reset. The panel and the health check are never affected |

**Schedulers.** The app and each custom module register a ColdBox scheduler (`appScheduler@coldbox`, `cbScheduler@reports`, `@inventory`, `@audit`, `@faults`), 15 tasks in all: healthy, failing, slow, overlapping, overlap guarded, conditional (`when`), calendar (`onWeekdays`) and paused. The `schedulers` page lists them with runs and failures and can run a task now.
ColdBox manages these schedulers itself and does **not** register them with the BoxLang scheduler service (checked: the service lists only the mail and BoxLang+ schedulers). So BxLens's **Tasks** page, which reads that service, does not list them. Their effect still shows up in **Threads** (worker threads, the 25 second tasks) and in the logs. The BoxLang scheduler in the main app is the one the Tasks page shows.

**Tests.** `app/cbApp/tests` has 47 TestBox specs (integration, API, errors, modules, schedulers, services). Run them at <http://localhost:8088/cbApp/tests/runner.bxm> or with `./test/smoke.sh`, which also walks every scenario of the catalog and checks its status.

Good to know: a framework reinit (`?fwreinit=1`) takes 12 to 22 seconds here, because shutting down the schedulers waits for the long running tasks. That is a scenario in itself. The data survives a reinit, and **Reset the data** on the home page reloads it. After changing a model, reinit.

### CFML

`/legacy/` has `.cfm` templates and a `.cfc` component (`cfquery`, `cfqueryparam`, `cfhttp`, `cflock`, `cfthread`, `cftry`, `cfthrow`) with the same N+1 and error stories. BxLens sees them like any other code. They need the `bx-compat-cfml` module, which the start script installs locally.

## Resetting

- **Reset all** on the control panel, or `GET /control.bxm?action=resetAll`.
- One scenario: `GET /control.bxm?action=reset&id=deadlock`. Ids: `deadlock`, `contention`, `executors`, `pool`, `memory`, `gc`, `threads`, `cpu`.
- The named `bx:lock` deadlock cannot be interrupted, so it ends after its 90 second timeout.
- Restarting the script gives a clean JVM and a fresh database.

## Check it works

With the demo running:

```bash
./test/smoke.sh        # BASE=http://localhost:9000 ./test/smoke.sh for another port
```

It requests every page, checks the status code (pages that fail on purpose must answer 500), starts and resets every scenario, and checks nothing is left running. It needs the real `bx-lens` module, because the pages call `lensMessage()` and friends.

## How it is laid out

```
app/                    the web root
  Application.bx        datasource (5 connection pool), seed data, scheduler registration
  index.bxm             control panel
  control.bxm           start and reset endpoint
  models/Scenarios.bx   the stateful scenarios and their reset
  schedulers/           DemoScheduler.bx
  concurrency/ runtime/ errors/ spans/ legacy/ api/ mail/ ormmodels/ orm.bxm mail.bxm
config/boxlang.json     BxLens settings, executors (demo-pool, demo-workers, demo-background)
modules/demoLens/       a tiny module that adds a panel to every request
app/boxlang_modules/    project-local installed modules (created by start.sh)
mock-smtp/smtp.bxs      the SMTP sink for the Mail page
start.sh                MiniServer launcher        Dockerfile, docker-compose.yml
server.json, box.json   CommandBox                 test/smoke.sh
```

The demo turns on more than BxLens does by default, so every tab has data: `collect.level` is `full`, bound query values are on, the functions, logs, BIFs and scopes collectors are on, and the slow query limit is 15 ms. Do not copy these settings to a real server. Read BxLens's own production guide first.

## Status of this repository

Be aware of what has and has not been run:

- **Run and checked** on BoxLang `1.19.0-snapshot` with MiniServer: the whole app, every scenario (start, JVM level effect, reset), the scheduler, the CFML pages and `start.sh`.
- **Not run yet**: BxLens itself. The pages that call `lensMessage()`, `lensException()` and friends were ported from the BxLens harness and not exercised here. What the bar and console show for each scenario, and Lensy's answers, are the intent of the page and need a pass with the real module.
- **Not run**: Docker, CommandBox and `./start.sh activate` (BoxLang+). The commands follow the documentation.
- **ORM and mail**: the pages run against the real `bx-orm` 1.7.2 snapshot and `bx-mail` 1.4.15 and the SMTP sink (entities save, a flush fails, every mail scenario sends, the failover works). What BxLens shows for them was not checked, and the Mail page stays empty until a `bx-mail` release announces `onMail` events.
- **ColdBox app** (`app/cbApp`): run on BoxLang 1.18 with MiniServer and the real `bx-compat-cfml`, `qb`, `quick` and ColdBox 8.3.0. All 72 scenarios of its catalog answer the status they say and all 47 TestBox specs pass. What BxLens shows for them was not checked, because the BxLens version used here asks the server to register before the console and bar work. The ColdBox schedulers are not listed on the BxLens Tasks page (see above).
- Windows: use Docker or WSL. There is no PowerShell script.
