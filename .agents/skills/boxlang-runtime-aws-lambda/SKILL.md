---
name: boxlang-runtime-aws-lambda
description: "Use this skill when building, deploying, or debugging BoxLang applications on AWS Lambda — including the handlers/ routing convention, manifest.json, Lambda.bx/Application.bx structure, environment variables, SAM CLI local testing, performance tuning, and the boxlang-starter-aws-lambda project."
---

# BoxLang on AWS Lambda

> BoxLang is the AI-native software productivity platform for building, modernizing and running applications, with developers and AI agents working together.

## Overview

The BoxLang AWS Lambda runtime (`ortus.boxlang.runtime.aws.LambdaRunner`) is a
pre-built Java handler for serverless Lambda functions. You write BoxLang
classes; the runtime handles request/response lifecycle, URI routing,
serialization, logging, and error management.

Starter template: `https://github.com/ortus-boxlang/boxlang-starter-aws-lambda`

---

## Handler Configuration

Set this as your Lambda handler in AWS:

```
ortus.boxlang.runtime.aws.LambdaRunner::handleRequest
```

The runtime automatically:
- Deserializes the incoming event (API Gateway v1/v2, Lambda Function URL, ALB, or direct invocation) into a BoxLang `Struct`
- Resolves the target `.bx` class by URI path (see Routing below)
- Calls its `run()` method (or an alternate method via the `x-bx-function` header)
- Serializes the return value back to JSON
- Manages error handling and logging

---

## Lambda.bx Convention

`Lambda.bx` at the project root is the **default handler** — it runs for `/`
and for any URI that doesn't match a registered route:

```boxlang
class {

    /**
     * The default Lambda handler function.
     *
     * @param event    The incoming event struct (deserialized from JSON)
     * @param context  The AWS Lambda context object (com.amazonaws.services.lambda.runtime.Context)
     * @param response A pre-built response struct you can populate:
     *                 { statusCode: 200, body: "", headers: {}, cookies: [] }
     */
    function run( event, context, response ){
        return {
            statusCode: 200,
            body: {
                message: "Hello from BoxLang Lambda!",
                input:   event
            }
        }
    }

}
```

You can either `return` a value (auto-serialized to JSON) or populate the
`response` struct directly - both work.

---

## Application Lifecycle (`Application.bx`)

Place `Application.bx` next to `Lambda.bx` at the project root for lifecycle
hooks. It fires for **every** request, whether it's served by `Lambda.bx` or
by a routed handler under `handlers/`:

```boxlang
class {
    this.name = "MyLambda"

    // Called once on cold start — initialize resources here
    boolean function onApplicationStart(){
        application.db = createObject("component","DataService").init()
        return true
    }

    // Called on every request before run()
    boolean function onRequestStart( required string targetPage ){
        return true
    }
}
```

`Application.bx` is never itself a URI-routing target, regardless of what a
client requests or what `x-bx-function` header it sends.

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

### Response modes (`BOXLANG_RESPONSE_MODE`)

| Mode | Lambda returns | Use for |
|------|----------------|---------|
| `http` (default) | The whole `response` struct, pre-seeded with `statusCode` (200), `headers`, `body`, `cookies` | API Gateway HTTP API, Function URLs |
| `raw` | Only `response.body`, unwrapped. Nothing predefined (`response` starts as `{ body: null }`) | Direct invocation, Step Functions, SQS, REST API without a proxy integration |

For a handler that does `return { id: 1 }`: `http` returns
`{ "statusCode": 200, "headers": {...}, "body": { "id": 1 }, "cookies": [] }`,
`raw` returns `{ "id": 1 }`. In `raw` mode any JSON value can be returned. Behind
a proxy integration the handler builds the envelope itself, e.g.
`return { statusCode: 201, body: serializeJSON( { id: 1 } ) }`. Any value other
than `http` or `raw` aborts cold start.

---

## URI Routing with `handlers/`

Every request goes to `Lambda.bx` by default. To route requests to a
different class based on the URL path, add it under `src/main/bx/handlers/`
instead of the project root:

```boxlang
// src/main/bx/handlers/Products.bx
class {
    function run( event, context, response ){
        response.body = { "message": "Hello from Products" }
        response.statusCode = 200
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
filename needs to be PascalCase. Matching is case-insensitive, and the
longest matching prefix wins.

**Only files under `handlers/` are ever routable.** `Application.bx`,
`Lambda.bx`, and anything else at the project root can never be reached this
way, no matter what path or `x-bx-function` header a client sends.

Use the `x-bx-function` header to call an alternative method on `Lambda.bx`
or any routed handler:

```bash
curl -H "x-bx-function: processOrder" https://api.example.com/products
```

Only a `public`/`remote` method you declared is reachable this way - BoxLang's
own scope rules gate it, so don't mark a method public if you don't want it
externally callable.

### `manifest.json`: the routing table

`./gradlew generateManifest` scans `handlers/` and writes
`src/main/bx/manifest.json` - the build-time routing table the runtime reads
**once at cold start** (never scanning the filesystem on a live request). It's
wired via `dependsOn` into `test`, `runLocal`, `runLocalApi`, `runLocalLegacy`,
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
`method` is honored as the fallback handler (falling back to the
`Lambda.bx`/`run()` convention when absent or pointing at a nonexistent file).

If `manifest.json` is missing or invalid, the runtime falls back to scanning
`handlers/` directly, and if that directory doesn't exist either, to scanning
the project root for backward compatibility with pre-`handlers/` deployments -
gated behind `BOXLANG_ENABLE_ROOT_SCAN` (default `true`; set to `false` to
restrict that last-resort scenario to the default handler only). Either
fallback logs a `WARNING` listing every handler it discovered.

---

## Project Structure (Starter Template)

```
/src
  /main
    /bx
      Application.bx     -- Lifecycle class
      Lambda.bx          -- Default handler
      handlers/          -- Routed handlers (see URI Routing above)
      manifest.json       -- Generated (gitignored) by ./gradlew generateManifest
    /resources
      boxlang.json        -- BoxLang runtime config
      boxlang_modules/    -- Installed BoxLang modules
  /test
    /java
      /com/myproject      -- JUnit integration tests + mocks
/workbench
  config.env              -- Default deployment config
  config.local.env        -- Your local overrides (gitignored)
  template.yml            -- SAM template used by 2-deploy.sh
  sampleEvents/           -- Test event payloads (.json files)
  0-check-aws.sh          -- Diagnose AWS credential/config issues
  1-create-bucket.sh      -- Create the S3 bucket for deployment artifacts
  2-deploy.sh             -- Build and deploy via SAM/CloudFormation
  3-invoke.sh             -- Invoke the deployed Lambda with a test payload
  4-cleanup.sh            -- Tear down all deployed AWS resources
/box.json                 -- BoxLang module dependencies
/build.gradle             -- Build config (shadowJar, generateManifest, buildLambdaZip)
/gradle.properties         -- version, jdkVersion, boxlangVersion
```

---

## Environment Variables

| Variable | Description |
|----------|-----------|
| `BOXLANG_LAMBDA_CLASS` | Absolute path to the default handler. Default: `/var/task/Lambda.bx` |
| `BOXLANG_LAMBDA_DEBUGMODE` | Enable debug mode + performance metrics (`true`/`false`) |
| `BOXLANG_LAMBDA_CONFIG` | Path to custom `boxlang.json`. Default: `/var/task/boxlang.json` |
| `BOXLANG_LAMBDA_CONNECTION_POOL_SIZE` | Database connection pool size. Default: `2` |
| `BOXLANG_ENABLE_ROOT_SCAN` | Allow the legacy root-directory routing fallback (see URI Routing above). Default: `true`. Shared across every BoxLang serverless runtime (AWS/GCP/Azure). |
| `BOXLANG_RESPONSE_MODE` | `http` (default envelope) or `raw` (unwrapped `response.body`). Any other value aborts cold start. |
| `LAMBDA_TASK_ROOT` | Lambda deployment root. Default: `/var/task` |

Any `BOXLANG_*` env variable also maps to `boxlang.json` config overrides.

---

## Performance Enhancements

### Class Compilation Caching

Handler classes are compiled and cached on the first (cold start) invocation.
Warm invocations reuse the cached bytecode - no re-compilation overhead.
Disable caching in development: `BOXLANG_LAMBDA_DEBUGMODE=true`.

### Connection Pooling

```bash
BOXLANG_LAMBDA_CONNECTION_POOL_SIZE=5
```

### Cold Start Optimization Tips

1. Use `Application.bx` `onApplicationStart()` to initialize shared resources
2. Minimize modules loaded at startup - only install what you use
3. Set `trustedCache: true` in `boxlang.json` for production

---

## Local Development

```bash
./gradlew test                       # run the test suite
./gradlew runLocal                   # test locally with the default event
./gradlew runLocalApi                # test locally with an API Gateway event
```

For HTTP endpoint testing with the [SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) installed:

```bash
./gradlew startSamServerBackground   # start a local API server at :3000
curl http://localhost:3000
curl -H "x-bx-function: anotherFunction" http://localhost:3000
./gradlew stopSamServer              # stop it when done
```

Sample event payloads live in `workbench/sampleEvents/` - pass one with
`-PeventFile=workbench/sampleEvents/s3-event.json`.

---

## Deploying to AWS

```bash
# One-time setup
cp workbench/config.env workbench/config.local.env
# edit config.local.env: AWS_LAMBDA_BUCKET, STACK_NAME, AWS_REGION, etc.

./workbench/1-create-bucket.sh
./workbench/2-deploy.sh
./workbench/3-invoke.sh
```

`config.local.env` is gitignored and layers over `config.env` →
environment variables. Key settings: `AWS_LAMBDA_BUCKET` (required, globally
unique), `STACK_NAME`, `LAMBDA_MEMORY`, `LAMBDA_TIMEOUT`, `AWS_REGION`.

The starter also ships GitHub Actions workflows (`.github/workflows/`) for
test, snapshot, and release builds - the AWS deployment step is commented out
by default; uncomment it once your function exists and your `AWS_*` secrets
are configured.

---

## BoxLang Modules in Lambda

```bash
box install {moduleName} --production --directory=src/resources/boxlang_modules
```

Or declare them in `box.json` under `dependencies`/`installPaths` and run
`box install --production`. Modules are automatically packaged into your
deployment ZIP under `boxlang_modules/`.

---

## Production Checklist

- [ ] `Application.bx` initializes shared resources (connections, config) in `onApplicationStart()`
- [ ] `BOXLANG_LAMBDA_DEBUGMODE=false` in production
- [ ] Connection pool size tuned: `BOXLANG_LAMBDA_CONNECTION_POOL_SIZE`
- [ ] Errors are shaped in `onError` (set `response.statusCode` when 500 is not right); remember `onError` always counts as handled
- [ ] `BOXLANG_RESPONSE_MODE=raw` for direct invocations and REST API non-proxy integrations
- [ ] Routing convention adopted: handlers live under `handlers/`, `manifest.json` regenerated via `generateManifest` (wired into `buildLambdaZip`)
- [ ] `BOXLANG_ENABLE_ROOT_SCAN=false` once you've fully migrated to `handlers/` (removes the legacy root-scan fallback)
- [ ] Secrets via AWS SSM Parameter Store or Secrets Manager, injected as env vars
- [ ] `boxlang.json` present in deployment package root, `trustedCache: true`
- [ ] Lambda timeout set generously for cold starts (30s+ recommended)
- [ ] Memory allocation ≥ 512MB (1024MB+ for better performance)
- [ ] Integration tests passing via `./gradlew test`
