---
name: boxlang-runtime-google-cloud-functions
description: "Use this skill when building, testing, or deploying BoxLang applications on Google Cloud Functions Gen 2, including the handlers/ routing convention, manifest.json, FunctionRunner entry point, environment variables, local development with the GCF invoker, and the boxlang-starter-google-functions project."
---

# BoxLang on Google Cloud Functions

> BoxLang is the AI-native software productivity platform for building, modernizing and running applications, with developers and AI agents working together.

## Overview

BoxLang runs on Google Cloud Functions Gen 2 via the Java 21 runtime. The
`FunctionRunner` bridge handles HTTP request mapping, handler routing, class
caching, and response serialization - so you focus on writing BoxLang
handler files.

Starter template: `https://github.com/ortus-boxlang/boxlang-starter-google-functions`

**Runtime entry point:**

```
ortus.boxlang.runtime.gcp.FunctionRunner
```

---

## Architecture

```
HTTP Request
    → GCF Gen 2 (java21 runtime)
    → FunctionRunner (HttpFunction)
    → RequestMapper (HttpRequest → BoxLang event struct)
    → Route resolution (manifest.json / handlers/ scan → .bx file)
    → Handler compilation + class cache (warm invocations)
    → Method dispatch (run() or x-bx-function header)
    → BoxLang handler execution
    → ResponseMapper (response struct → HttpResponse)
```

---

## Starter Project

```bash
git clone https://github.com/ortus-boxlang/boxlang-starter-google-functions.git
cd boxlang-starter-google-functions

# Verify environment
./gradlew clean test
```

---

## Lambda.bx Convention

`Lambda.bx` at the project root is the **default handler** - it runs for `/`
and for any URI that doesn't match a registered route:

```boxlang
// src/main/bx/Lambda.bx
class {

    function run( event, context, response ){
        response.statusCode = 200
        response.headers    = { "Content-Type": "application/json" }
        response.body       = jsonSerialize({
            message: "Hello from BoxLang!",
            input:   event
        })
    }

    // Alternative method (call with x-bx-function header)
    function anotherLambda( event, context, response ){
        return "Hola!!"
    }

}
```

---

## Application Lifecycle (`Application.bx`)

Place `Application.bx` next to `Lambda.bx` at the project root for lifecycle
hooks. It fires for **every** request, whether it's served by `Lambda.bx` or
by a routed handler under `handlers/`, and is never itself a URI-routing
target.

```boxlang
class {
    this.name = "MyFunction"

    boolean function onApplicationStart(){
        application.db = createObject("component","DataService").init()
        return true
    }

    boolean function onRequestStart( required string targetPage ){
        return true
    }
}
```

### Wrapping responses and handling errors

`run()` and every request lifecycle hook (`onRequestStart`, `onRequestEnd`,
`onError`, `onAbort`) receive the same `response` struct as their **last** argument. The value a handler returns is stored in
`response.body` before `onRequestEnd` runs, so a hook can wrap or replace it:

```boxlang
class {
    function onRequestEnd( target, event, context, response ){
        response.body = { ok: true, data: response.body }
    }

    function onError( exception, eventName, event, context, response ){
        response.body = { ok: false, error: exception.message }
        // response.statusCode = 404   // override the default 500
    }
}
```

Hook arguments: `onRequestStart( target, event, context, response )`,
`onRequestEnd( target, event, context, response )`,
`onError( exception, eventName, event, context, response )`,
`onAbort( target, event, context, response )`. `onApplicationStart` and the
session hooks are fired by BoxLang itself and receive no request data.

Rules to remember:

- `onRequestEnd` runs **before** `onError`. On a failure `onRequestEnd` wraps
  the empty body first, then `onError` overwrites it, so `onError` has the last word.
- A handled error defaults the status to `500` unless `onError` sets
  `response.statusCode`. It used to be `200`.
- If `Application.bx` defines `onError`, the error counts as handled whatever
  the hook returns. To fail the invocation, rethrow from `onError` or do not define it.
- Hooks that do not declare the extra `response` argument keep working.

---

## URI Routing with `handlers/`

Every request goes to `Lambda.bx` by default. To route requests to a
different class based on the URL path, add it under `src/main/bx/handlers/`
instead of the project root:

```boxlang
// src/main/bx/handlers/Products.bx
class {
    function run( event, context, response ){
        response.statusCode = 200
        response.body = {
            "error": false,
            "data": [ "Product A", "Product B" ]
        }
    }
}
```

| Incoming URI | Handler File |
|---|---|
| `/products` | `handlers/Products.bx` |
| `/api/test` | `handlers/api/Test.bx` (nested) |
| `/user-profiles` | `handlers/UserProfiles.bx` (hyphens map to PascalCase) |
| `/` or anything unmatched | `Lambda.bx` (the default handler) |

Folders can be nested and use any case you like - only the leaf `.bx`
filename needs to be PascalCase. **Only files under `handlers/` are ever
routable.** `Application.bx`, `Lambda.bx`, and anything else at the project
root can never be reached this way, no matter what path or `x-bx-function`
header a client sends.

### `manifest.json`: the routing table

`./gradlew generateManifest` scans `handlers/` and writes
`src/main/bx/manifest.json` - the build-time routing table the runtime reads
**once at cold start**. It's wired via `dependsOn` into `test`, `runFunction`,
and `buildLambdaZip`, so it can never silently drift. It's gitignored - never
hand-edited or committed.

```json
{
	"manifestVersion": 1,
	"defaultHandler": { "file": "Lambda.bx", "method": "run" },
	"handlers": {
		"products": { "file": "handlers/Products.bx" },
		"api/test": { "file": "handlers/api/Test.bx" }
	},
	"reserved": ["Application.bx", "Lambda.bx"]
}
```

The runtime **enforces** `reserved` and `defaultHandler`, not just documents
them: a manifest can never route to a reserved file, and `defaultHandler.file`/
`method` is honored as the fallback handler when present.

If `manifest.json` is missing or invalid, the runtime falls back to scanning
`handlers/` directly, and if that directory doesn't exist either, to scanning
the function root for backward compatibility with pre-`handlers/`
deployments - gated behind `BOXLANG_ENABLE_ROOT_SCAN` (default `true`; set to
`false` to restrict that last-resort scenario to the default handler only).

---

## Calling Specific Methods (Header Routing)

Use the `x-bx-function` header to call a specific method on the resolved
handler:

```bash
curl http://localhost:9099/products                                  # run()
curl -H "x-bx-function: createOrder" -X POST http://localhost:9099/products \
    -H "Content-Type: application/json" \
    -d '{"productId": 1, "qty": 2}'
```

Only a `public`/`remote` method you declared is reachable this way.

---

## Environment Variables

| Variable | Description |
|----------|-----------|
| `BOXLANG_GCP_ROOT` | Root directory for `.bx` files. Default: `/workspace` |
| `BOXLANG_GCP_CLASS` | Override the default handler path |
| `BOXLANG_GCP_DEBUGMODE` | Enable verbose logging and disable class caching |
| `BOXLANG_GCP_CONFIG` | Path to a custom `boxlang.json` configuration |
| `BOXLANG_ENABLE_ROOT_SCAN` | Allow the legacy root-directory routing fallback (see URI Routing above). Default: `true`. Shared across every BoxLang serverless runtime (AWS/GCP/Azure). |
| `K_SERVICE` / `K_REVISION` / `GOOGLE_CLOUD_PROJECT` | Set automatically by GCF |

---

## Local Development

```bash
./gradlew runFunction                        # start local server (port 9099)
./gradlew runFunction -PtestPort=8080         # custom port
./gradlew runFunction -PdebugMode=true        # disable class cache for hot reload
```

```bash
curl http://localhost:9099/
curl -X POST http://localhost:9099/products -H "Content-Type: application/json" -d '{"qty":2}'
curl -H "x-bx-function: anotherLambda" http://localhost:9099/
```

---

## Cold Start, Warm Start, Debug Mode

| Mode | Behavior |
|------|---------|
| Cold start | Runtime initializes; first request is slower |
| Warm invocation | Compiled handler class reused - fast |
| Debug mode ON | Class cache disabled; edits picked up immediately |
| Debug mode OFF (production) | Maximum performance via class caching |

---

## Deploying to GCP

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

./gradlew clean shadowJar buildLambdaZip

gcloud functions deploy YOUR_FUNCTION_NAME \
  --gen2 \
  --runtime=java21 \
  --region=us-central1 \
  --entry-point=ortus.boxlang.runtime.gcp.FunctionRunner \
  --trigger-http \
  --allow-unauthenticated \
  --source=build/distributions/boxlang-google-function-project-1.0.0.zip
```

If you changed `version` in `gradle.properties`, update the ZIP filename in
`--source` accordingly.

---

## Portability with AWS Lambda and Azure Functions

Handler patterns are intentionally identical across all three BoxLang
serverless runtimes - the same `handlers/` convention, `manifest.json`
schema, `run(event, context, response)` contract, and `x-bx-function`
header dispatch. `.bx` code moves between providers unmodified.

| Feature | GCF | AWS Lambda | Azure Functions |
|---------|-----|-----------|-----------|
| Runner class | `FunctionRunner` | `LambdaRunner` | `AzureFunctionRunner` |
| Handler method | `run()` | `run()` | `run()` |
| Method routing header | `x-bx-function` | `x-bx-function` | `x-bx-function` |
| Debug mode env var | `BOXLANG_GCP_DEBUGMODE` | `BOXLANG_LAMBDA_DEBUGMODE` | `BOXLANG_AZURE_DEBUGMODE` |
| Root-scan opt-out | `BOXLANG_ENABLE_ROOT_SCAN` | `BOXLANG_ENABLE_ROOT_SCAN` | `BOXLANG_ENABLE_ROOT_SCAN` |

---

## Production Checklist

- [ ] `BOXLANG_GCP_DEBUGMODE=false` in production
- [ ] Errors are shaped in `onError` (set `response.statusCode` when 500 is not right); remember `onError` always counts as handled
- [ ] Routing convention adopted: handlers live under `handlers/`, `manifest.json` regenerated via `generateManifest` (wired into `buildLambdaZip`)
- [ ] `BOXLANG_ENABLE_ROOT_SCAN=false` once you've fully migrated to `handlers/`
- [ ] Secrets injected as environment variables (not in code)
- [ ] Memory: 512MB minimum; 1GB+ for database-heavy functions
- [ ] Integration tests passing: `./gradlew clean test`
- [ ] Deployment ZIP built fresh before each deploy: `./gradlew shadowJar buildLambdaZip`
