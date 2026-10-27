# Demo script: finding and tracking issues with BxLens

For a developer audience. About 45 minutes with questions. The point of the session: a developer gets a ticket, and BxLens tells them where to look.

- Demo: <http://localhost:8088>. Console: <http://localhost:8088/~bxlens/index.bxm>, password `lens-demo` (viewer: `lens-view`).
- BoxLang+ pages are marked **(Plus)**. Everything else works on Free.

## Before you start (15 minutes ahead)

1. `./start.sh` and wait for it to say it is listening. Do not start it during the session: the first start downloads modules.
2. Open the console in its own tab, sign in, and leave the bar closed on the demo tab.
3. Warm up so the dashboards have data:
   - **Traffic generator** (`/traffic.bxm`): Start, 300 requests, 4 at once.
   - **AI agents** (`/ai.bxm`): press **Run 30 rounds**. **(Plus)**
   - **Fleet** (`/fleet.bxm`): press **Write now**. The mock servers keep writing every 30 seconds. **(Plus)**
4. Run `./test/smoke.sh` once. It walks the pages and the ColdBox catalog and says what failed.
5. Press **Reset all** on the control panel before you begin, so the third investigation starts clean.

## 1. The bar: one request, everything about it (5 min)

Say: the bar answers "what happened in this request". It is for the developer who has the page open.

1. `/orders.bxm`: green strip. Open the bar. **Timeline** (the waterfall), **Queries**, **Messages and Timers**.
2. `/n-plus-one.bxm`: the strip turns amber. Issues chip, then **Queries**: one statement repeated, with the line that ran it.
3. `/caught-exception.bxm`: the bar opens on Issues by itself. Say: a caught exception still counts.
4. `/http-failures.bxm`: **HTTP** tab. Nine calls, each failing differently: 503, 429, a timeout, a redirect, a large body, 404, an unknown host, a refused connection.
5. `/cost.bxm?mode=cpu`, then `?mode=memory`: **Request** tab, request cost. **(Plus)** Say: two pages can take the same time and cost very different things.
6. `/security.bxm?variant=insecure`, then `?variant=hardened`: console **Requests**, open the request, **Issues**. Security headers and cookie flags are notes, not errors.

## 2. Solving an issue: ticket 1, "Checkout takes forever" (8 min)

Open `/investigate/`. Read the ticket out loud. Press **Reproduce** on ticket 1. Do not open the code.

Find the cause, in this order:

1. Console **Overview**: p95 is up. **Reports**: `/investigate/checkout.bxm` is the slowest URL.
2. **Requests**: open one. **Issues** lists three findings:
   - **N+1**: the same customer statement 25 times.
   - **Slow outgoing HTTP**: the carrier quote takes about 1.2 seconds, the biggest span of the timeline.
   - Slow template time from the tax loop.
3. **Caches**: the default cache shows misses and no stored tax entries. The result is never stored.
4. Say what to fix: one join, cache the quote, store the tax entry.

Takeaway: one request can have three causes. The Issues list ranks them.

## 3. Tracking an issue: ticket 2, "Some payments fail" (8 min)

Press **Reproduce** on ticket 2 (24 requests, 8 at once).

1. Console **Errors**: one group, `PaymentGatewayError`, about a quarter of the requests. Open a sample: the stack, the request, and the message says the gateway answered 503.
2. **Requests**: filter on 500. The failing attempts are every fourth one.
3. **HTTP** page: the gateway endpoint fails 25% of its calls, with the failures counted apart from the successes.
4. **Datasources**: 5 of 5 connections in use, waits. Say: every payment holds a connection for 900 ms inside a transaction, and then waits on the gateway. Under load that starves the pool, which is why it "gets worse".
5. Say what to fix: do not hold the transaction while calling out, retry or break the circuit on a 503.

Takeaway: an error that happens "sometimes" has a rate. BxLens shows the rate, the sample and the cause.

## 4. Ticket 3, "The site gets slower the longer it runs" (6 min)

Press **Reproduce** on ticket 3 (120 requests, 4 at once).

1. **Reports**: the slowest URL is `/investigate/slowdown.bxm`. **Requests**: open an early request and a late one. Same URL, the late one is several times slower, and the timeline shows the time inside the template, not in a query or a call.
2. **System**: heap used climbs and does not fall back. GC time grows.
3. Request cost **(Plus)**: CPU time per request grows while the work looks the same.
4. Heap dump **(Plus)**: it shows the application scope holding hundreds of search results.
5. Say what to fix: a bounded cache with expiry, and no scan of everything on each request.

Press **Reset all** afterwards.

## 5. Runtime problems (6 min)

From the control panel:

1. **Executors**: Saturate `demo-pool`. Console **Executors** shows a critical pool with a queue next to a healthy one.
2. **Deadlock**: Start (Java locks). Console **System** names both threads. **Threads** shows them waiting. Reset.
3. **Scheduled tasks** (`/tasks.bxm`): console **Tasks** shows healthy, failing, slow, overlapping and paused. Run now, pause and resume are **(Plus)**.
4. **File watchers** (`/watchers.bxm`): press **Fail**. The failing watcher stops itself after 5 errors. Press **Burst** for 200 events.

## 6. AI observability **(Plus)** (8 min)

Say first: these are real agents running on bx-ai's **mock provider**. The model's words are scripted, everything around them is real: the agent loop, tools, MCP calls, delegation, failures and slow calls. No model is called and nothing is billed. Token counts come from the mock.

Console **Modules, AI** (turn the integration on there if it is off):

1. **Overview**: runs, success rate, p95, tokens and cost. **What needs attention** names `FlakyReporter` (its `generate_report` tool fails about a third of calls).
2. **Agents**: five agents. Open **Coordinator**: the Composition diagram shows its model and two sub-agents.
3. **Runs**: open a Coordinator run. The trace shows the model turns, `delegate_to_orderresearcher` and `delegate_to_shippingplanner`, and the 2 second carrier tool.
4. Open a failed `FlakyReporter` run: the tool error and its time.
5. **MCP**: the two servers this app hosts, with their calls. One of the heartbeat calls fails every seventh time.
6. **Models** and **Cost**: `mock-small` and `mock-large` with the prices set in `boxlang.json`.
7. Ask Lensy: *which agent fails the most, and why?*

## 7. Three servers (3 min) **(Plus)**

`web-a` is this server. `web-b` and `web-c` are mock servers: a scheduler task writes their saved numbers into the shared store folder, the same way real servers do. Say that out loud.

1. Console header **Server** selector: three servers.
2. **Overview**, Servers table: `web-c` has high heap, a deadlock and failing tasks.
3. **All servers** on **Reports** or **Errors**: totals added up, the same error listed once with every server that saw it.
4. On `/fleet.bxm` set `web-c` to **silent**: after two minutes the selector shows it as behind.

## 8. Lensy (3 min)

Ask: *diagnose this server*. Then *which requests are slowest and why?* Lensy answers by calling the same tools the console uses. This needs Ollama (`WITH_AI=1 ./start.sh`). If it is not set up, skip this section.

## If something goes wrong

| Problem | Do this |
|---|---|
| A scenario is stuck | **Reset all** on the control panel |
| The AI page is empty | Check **Modules, Integrations** has AI on, then `/ai.bxm` **Run 30 rounds** |
| No second and third server | `/fleet.bxm` **Write now**. Needs BoxLang+ and the store folder set by `start.sh` |
| The ColdBox app answers 503 | It is reinitializing. Wait 20 seconds |
| A page needs BoxLang+ and you are on Free | Skip it and say it is Plus. The numbers behind most pages are there on Free |

## What not to claim

- The mock AI is scripted. Say so before someone asks.
- `web-b` and `web-c` are not real servers.
- ColdBox schedulers do not appear on the Tasks page, because ColdBox keeps them in its own service. Their threads and logs do appear.
