---
name: boxlang-runtime-azure-functions
description: "Use this skill when building, testing, or deploying BoxLang applications on Microsoft Azure Functions, including the handlers/ routing convention, manifest.json, AzureFunctionRunner entry point, the Function.java wrapper class, environment variables, local development with Azure Functions Core Tools, and the boxlang-starter-azure-functions project."
---

# BoxLang on Azure Functions

> BoxLang is the AI-native software productivity platform for building, modernizing and running applications, with developers and AI agents working together.

## Overview

BoxLang runs on Azure Functions via a Java 21 worker. The
`AzureFunctionRunner` bridge handles HTTP request mapping, handler routing,
class caching, and response serialization - so you focus on writing BoxLang
handler files.

This runtime is a structural mirror of the [AWS Lambda](https://github.com/ortus-boxlang/boxlang-aws-lambda) and [Google Cloud Functions](https://github.com/ortus-boxlang/boxlang-google-functions) runtimes: same `handlers/` routing convention, same `manifest.json` schema, same `run(event, context, response)` handler contract, same `x-bx-function` header dispatch. Your `.bx` code moves between all three providers unmodified.

Starter template: `https://github.com/ortus-boxlang/boxlang-starter-azure-functions`

**Runtime entry point:**

```
ortus.boxlang.runtime.azure.AzureFunctionRunner
```

---

## Starter Project

```bash
git clone https://github.com/ortus-boxlang/boxlang-starter-azure-functions.git
cd boxlang-starter-azure-functions

cp local.settings.json.example local.settings.json
./gradlew test
```

---

## Project Structure

```
.
├── build.gradle                        # Gradle build, generateManifest task, azurefunctions {} config
├── host.json                           # Azure Functions host config (routePrefix is "")
├── local.settings.json.example         # Copy to local.settings.json for local runs
├── src/
│   ├── main/
│   │   ├── java/com/myproject/
│   │   │   └── Function.java           # Thin Azure entry point - forwards to AzureFunctionRunner
│   │   ├── bx/
│   │   │   ├── Application.bx          # Application lifecycle hooks
│   │   │   ├── Lambda.bx               # Default handler (root "/" and fallback)
│   │   │   └── handlers/
│   │   │       ├── Products.bx         # Routed handler -> /products
│   │   │       └── api/
│   │   │           └── Test.bx         # Nested routed handler -> /api/test
│   │   └── ...
│   └── resources/
│       └── boxlang.json                # BoxLang runtime configuration
└── src/test/java/com/myproject/
    ├── AzureFunctionIntegrationTest.java
    └── mocks/                          # Mock Azure types for fast, no-network tests
```

---

## The `Function.java` Wrapper (Azure-Specific)

Unlike AWS Lambda or Google Cloud Functions, Azure's build plugins only scan
**your own project's compiled classes** for `@FunctionName` methods when
generating `function.json` - they never look inside dependency jars. Since
the actual routing/execution logic lives in the `boxlang-azure-functions`
runtime dependency, every Azure starter project needs a two-line wrapper
class that carries the `@FunctionName`/`@HttpTrigger` annotations and
forwards every request straight to `AzureFunctionRunner`:

```java
// src/main/java/com/myproject/Function.java
public class Function {

	private final AzureFunctionRunner runner = new AzureFunctionRunner();

	@FunctionName( "BoxLangFunction" )
	public HttpResponseMessage run(
	    @HttpTrigger(
	        name = "req",
	        methods = { HttpMethod.GET, HttpMethod.POST, HttpMethod.PUT, HttpMethod.DELETE, HttpMethod.PATCH, HttpMethod.OPTIONS, HttpMethod.HEAD },
	        authLevel = AuthorizationLevel.ANONYMOUS,
	        route = "{*path}"
	    ) HttpRequestMessage<Optional<String>> request,
	    final ExecutionContext context
	) {
		return runner.run( request, context );
	}
}
```

You should never need to touch this file - add BoxLang code under
`handlers/` instead.

---

## Lambda.bx Convention

`Lambda.bx` at the project root is the **default handler** - it runs for `/`
and for any URI that doesn't match a registered route:

```boxlang
// src/main/bx/Lambda.bx
class {

    function run( event, context, response ){
        return { "message": "Hello from BoxLang on Azure Functions!" }
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
    this.name = "MyAzureFunction"

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

Only files under `src/main/bx/handlers/` (or listed in the build-time
`manifest.json`) are ever reachable by URI. `Application.bx` and the default
`Lambda.bx` are never routable, no matter what's on disk.

| Incoming URI | Handler File |
|---|---|
| `/products` | `handlers/Products.bx` |
| `/api/test` | `handlers/api/Test.bx` (nested) |
| `/user-profiles` | `handlers/UserProfiles.bx` (hyphens map to PascalCase) |
| `/` or anything unmatched | `Lambda.bx` (the default handler) |

Add a new route by creating a `.bx` file under `handlers/`:

```boxlang
// src/main/bx/handlers/Orders.bx
class {
    function run( event, context, response ) {
        return { "message": "Fetching orders" };
    }
}
```

### `manifest.json`: the routing table

`./gradlew generateManifest` scans `handlers/` and writes
`src/main/bx/manifest.json` - the build-time routing table the runtime reads
**once at cold start**. It's wired via `dependsOn` into `test`,
`azureFunctionsRun`, `azureFunctionsPackage`, and `azureFunctionsDeploy`, so
it can never silently drift. It's gitignored - never hand-edited or
committed.

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

## Local Development

```bash
./gradlew test                # run the test suite
./gradlew azureFunctionsRun   # start the local Azure Functions host (Core Tools)
```

```bash
curl http://localhost:7071/
curl http://localhost:7071/products
curl http://localhost:7071/api/test
curl http://localhost:7071/ -H "x-bx-function: anotherLambda"
```

Set `BOXLANG_AZURE_DEBUGMODE=true` in `local.settings.json` to enable
verbose logging and disable handler-class caching, so `.bx` changes are
picked up without restarting the host.

Tests in `src/test/java/com/myproject/` exercise the full request pipeline
using `AzureFunctionRunner` directly with mock Azure request/context
objects (`mocks/`) - no live Azure environment or Core Tools required, so
they run fast in CI.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `BOXLANG_AZURE_ROOT` | Root directory for `.bx` files | Azure-provided `AzureWebJobsScriptRoot`, else `/home/site/wwwroot` |
| `BOXLANG_AZURE_CLASS` | Override the default `Lambda.bx` path | *(unset)* |
| `BOXLANG_AZURE_DEBUGMODE` | Verbose logging, disables handler-class caching | `false` |
| `BOXLANG_AZURE_CONFIG` | Path to a custom `boxlang.json` | `boxlang.json` in root |
| `BOXLANG_ENABLE_ROOT_SCAN` | Allow the legacy root-directory routing fallback (see URI Routing above) | `true`. Shared across every BoxLang serverless runtime (AWS/GCP/Azure). |

---

## Deploying to Azure

```bash
az login

export AZURE_SUBSCRIPTION_ID=<your-subscription-id>
export AZURE_RESOURCE_GROUP=<your-resource-group>
export AZURE_FUNCTION_APP_NAME=<your-function-app-name>
export AZURE_REGION=eastus

./gradlew azureFunctionsDeploy
```

The `azurefunctions {}` block in `build.gradle` reads all deployment
settings from these environment variables - nothing is hard-coded, so the
same `build.gradle` works in CI/CD and locally.

`host.json` sets `routePrefix` to `""` deliberately, so Azure's URL path
shape has no prefix to strip and matches AWS/GCF's raw path exactly.

---

## Portability with AWS Lambda and Google Cloud Functions

| Feature | Azure Functions | AWS Lambda | GCF |
|---------|-----------|-----------|-----|
| Runner class | `AzureFunctionRunner` | `LambdaRunner` | `FunctionRunner` |
| Handler method | `run()` | `run()` | `run()` |
| Method routing header | `x-bx-function` | `x-bx-function` | `x-bx-function` |
| Debug mode env var | `BOXLANG_AZURE_DEBUGMODE` | `BOXLANG_LAMBDA_DEBUGMODE` | `BOXLANG_GCP_DEBUGMODE` |
| Root-scan opt-out | `BOXLANG_ENABLE_ROOT_SCAN` | `BOXLANG_ENABLE_ROOT_SCAN` | `BOXLANG_ENABLE_ROOT_SCAN` |
| Extra scaffolding | `Function.java` wrapper (required) | none | none |

---

## Production Checklist

- [ ] `Application.bx` initializes shared resources in `onApplicationStart()`
- [ ] `BOXLANG_AZURE_DEBUGMODE=false` in production
- [ ] Errors are shaped in `onError` (set `response.statusCode` when 500 is not right); remember `onError` always counts as handled
- [ ] Routing convention adopted: handlers live under `handlers/`, `manifest.json` regenerated via `generateManifest` (wired into `azureFunctionsPackage`/`azureFunctionsDeploy`)
- [ ] `BOXLANG_ENABLE_ROOT_SCAN=false` once you've fully migrated to `handlers/`
- [ ] Secrets via Azure Key Vault or App Settings, injected as env vars
- [ ] `boxlang.json` present with `trustedCache: true` for production
- [ ] `requestTimeout` matches your hosting plan's execution limit (Consumption plan defaults to 5 minutes)
- [ ] Integration tests passing via `./gradlew test`
