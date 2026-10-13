# BxLens demo

A demo application for [BxLens](https://github.com/ortus-solutions-private/bx-lens), the BoxLang debug bar and console. Every page produces one kind of data that BxLens can show, so you can demo each feature, and ask **Lensy**, the Box Agent for your server, about it.

It has two kinds of pages:

- **Request pages** (N+1 queries, slow queries, caught and uncaught errors, HTTP calls, cache, forms, sessions, CFML) show up in the **bar** at the bottom of the page and in the console.
- **Scenarios** run real threads, locks, connections and memory on the JVM: a deadlock, lock contention, a saturated executor, an exhausted connection pool, a memory leak, GC pressure, a thread leak and CPU burn. Each has a **Start** and a **Reset** button, so you can run the same story again.

The control panel at `/` lists everything, says what to look at in BxLens, and has **Reset all**.

> **Scenarios are real.** They hold threads, connections and up to 40 percent of the heap on the JVM that runs the demo. Run the demo on a machine you do not mind stressing, never next to anything else, and press **Reset all** when you finish.

## Quick start

You need Java 21 or later and `curl`. Pick one way to run it.

### 1. MiniServer script (Linux and macOS)

```bash
git clone https://github.com/ortus-boxlang/bx-lens-demo
cd bx-lens-demo
./start.sh
```

The script downloads BoxLang, MiniServer, the Derby and CFML compatibility modules, `bx-plus` and `bx-lens` into `.cache/`, builds a fresh BoxLang home in `.run/home`, and starts the demo.

| | |
|---|---|
| Demo | <http://localhost:8085> |
| Console | <http://localhost:8085/~bxlens/index.bxm> |
| Console password | `lens-demo` (admin) and `lens-view` (viewer) |

Options, all environment variables:

| Variable | Default | What it does |
|---|---|---|
| `PORT`, `HOST` | `8085`, `127.0.0.1` | Where to listen |
| `LENS_ZIP` | | Path to a `bx-lens` module zip (a build, or a drop from the team). Use this until BxLens is published |
| `LENS_VERSION` | `latest` | Released version to install from downloads.ortussolutions.com |
| `BOXLANG_VERSION` | `1.19.0-snapshot` | BxLens needs BoxLang 1.19.0 or later. Change this to `1.19.0` once it is released |
| `LENS_LICENSE` | | Show a license state in the console: `trial`, `plus`, `expired` or `none` |
| `WITH_AI` | | Set to `1` to turn Lensy on (see [Lensy](#lensy-and-ollama)) |
| `OLLAMA_URL`, `OLLAMA_MODEL` | `http://localhost:11434`, `llama3.2` | Where Lensy finds its model |

### 2. Docker

Starts the demo, an Ollama server, and pulls a tool-calling model for Lensy.

```bash
cp /path/to/bx-lens.zip drop/        # until BxLens is published, or set LENS_VERSION instead
LENS_ZIP=/demo/drop/bx-lens.zip docker compose up --build
```

Same URLs as above. The first start downloads the model, which takes a few minutes. The container allows console access from private networks (`LENS_ACCESS`), because a published port does not arrive from loopback. That is fine on your laptop and wrong on a shared server.

### 3. CommandBox

```bash
box install
box server start
```

`server.json` selects BoxLang, uses `config/boxlang.commandbox.json` and installs the modules. Use `/~bxlens/index.bxm` for the console. The `demoLens` module panel (the extra panel on every page) is only installed by the MiniServer script and Docker.

## BoxLang+ and Lensy

BxLens is free with limits. Lensy, task actions, cache actions, heap dumps, longer history and saving to disk need **BoxLang+** or a trial. For a public demo, activate a license once:

```bash
export BX_LICENSE_EMAIL="you@example.com"
export BX_LICENSE_KEY="..."
./start.sh activate
```

This runs `module:plus activate` against the demo's own BoxLang home (`.run/home`). The home is kept between starts, so you activate once. The console header changes to `BoxLang+ active` within five minutes. To show only a license *state* without a real license, use `LENS_LICENSE=trial|plus|expired|none`.

### Lensy and Ollama

Lensy uses a model through `bx-ai`. The demo is set up for a local [Ollama](https://ollama.com), so nothing leaves your machine.

```bash
ollama pull llama3.2            # chat model, supports tool calling
ollama pull nomic-embed-text    # embeddings for the documentation search
WITH_AI=1 ./start.sh
```

Open the console, **AI** page, press **Test connection**. With Docker this is already done for you. To use another model, set `OLLAMA_MODEL`. A larger model answers harder questions better.

## Ten minute showcase

Open the demo, start the console in another tab (<http://localhost:8085/~bxlens/index.bxm>, log in with `lens-demo`). Keep the bar closed until you need it.

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
| `/tasks.bxm` | The scheduler `demoScheduler`: `refresh-stats` healthy, `sync-prices` failing, `nightly-report` slow, `export-orders` overlapping, `warm-cache` paused. Tasks start with the first request to the app |
| `/traffic.bxm` | A browser side generator with a weighted mix of pages, 404s and 500s |

### CFML

`/legacy/` has `.cfm` templates and a `.cfc` component (`cfquery`, `cfqueryparam`, `cfhttp`, `cflock`, `cfthread`, `cftry`, `cfthrow`) with the same N+1 and error stories. BxLens sees them like any other code. They need the `bx-compat-cfml` module, which the start script installs.

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
  concurrency/ runtime/ errors/ spans/ legacy/ api/
config/boxlang.json     BxLens settings, executors (demo-pool, demo-workers, demo-background)
modules/demoLens/       a tiny module that adds a panel to every request
start.sh                MiniServer launcher        Dockerfile, docker-compose.yml
server.json, box.json   CommandBox                 test/smoke.sh
```

The demo turns on more than BxLens does by default, so every tab has data: `collect.level` is `full`, bound query values are on, the functions, logs, BIFs and scopes collectors are on, and the slow query limit is 15 ms. Do not copy these settings to a real server. Read BxLens's own production guide first.

## Status of this repository

Be aware of what has and has not been run:

- **Run and checked** on BoxLang `1.19.0-snapshot` with MiniServer: the whole app, every scenario (start, JVM level effect, reset), the scheduler, the CFML pages and `start.sh`.
- **Not run yet**: BxLens itself. The module is not published, so `start.sh` needs `LENS_ZIP` until it is. The pages that call `lensMessage()`, `lensException()` and friends were ported from the BxLens harness and not exercised here. What the bar and console show for each scenario, and Lensy's answers, are the intent of the page and need a pass with the real module.
- **Not run**: Docker, CommandBox and `./start.sh activate` (BoxLang+). The commands follow the documentation.
- **Not included yet**: the ORM and mail integrations of the BxLens harness (they need `bx-orm` and `bx-mail`, plus a mail sink).
- Windows: use Docker or WSL. There is no PowerShell script.
