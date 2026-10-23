---
name: coldbox-testing-browser
description: "Use this skill when writing browser tests for a ColdBox application with coldbox.system.testing.BrowserTestCase (BoxLang + bx-playwright): choosing browser tests vs BaseTestCase integration tests, browse() with isolated pages, the baseURL and browserProfile annotations, this.playwright(), browserAvailable() and browserUnavailableReason(), the named route helpers routeURL(), visitRoute() and assertRouteIs() (with or without params, name@module and module:name routes), logging users in and out with loginAs() and logout() through the test-only BrowserTesting core module (moduleSettings.browserTesting enabled/token/login/logout, X-Browser-Testing-Token header, testing environment only, 404 otherwise), running the app server for the browser (CommandBox server or TestBox --web-server), and CI setup."
applyTo: "**/tests/**/*.{bx,bxm}"
---

# ColdBox Browser Testing (BrowserTestCase)

## When to Use This Skill

- Testing user journeys of a ColdBox app in a real browser: forms, redirects, sessions, JavaScript widgets, login flows
- Visiting and asserting on **named routes** instead of hard coded URLs
- Logging a user in or out of a browser test without filling the login form
- Configuring the `BrowserTesting` core module safely
- Running the application server for the browser locally and in CI

For the TestBox side (matchers, attachments, retries, runner options, debugging) see the `testbox-browser-testing` skill.

## BrowserTestCase vs BaseTestCase

`coldbox.system.testing.BrowserTestCase` extends `BaseTestCase`: it still **loads your app virtually** (for routes, module entry points and settings), and drives a real browser through [bx-playwright](https://bxplaywright.boxlang.io) against your **running** app server.

| | `BaseTestCase` integration tests | `BrowserTestCase` browser tests |
|---|---|---|
| Runs | Inside a virtual app, no web server | A real browser against your running server |
| Speed | Milliseconds per spec | Hundreds of ms to seconds per spec |
| Sees | `rc`, `prc`, rendered content, handler results | The rendered page: text, visibility, URLs, form values |
| JavaScript, CSS, cookies | No | Yes |
| Best for | Handler logic, APIs, relocations, security rules | User journeys, forms, front-end behavior, smoke tests |

Keep many integration tests and a smaller set of browser tests for the journeys that matter most.

## Requirements

- **BoxLang only** (1.17+, Java 21+): `BrowserTestCase` is a `.bx` class. Keep browser specs in `tests/specs/browser` and exclude that folder on Lucee/Adobe. The app under test may be CFML-configured, but the specs need BoxLang.
- ColdBox 8.3.0+ and TestBox 7.2.0+ (`testbox.system.browser`).
- bx-playwright and a browser, loaded in the runtime that runs the tests:

```bash
install-bx-module bx-playwright
bxPlaywright install chromium      # add --with-deps on Linux CI
bxPlaywright doctor
```

For a CommandBox BoxLang server, install it in the server, for example in `server.json`:

```json
{
	"app" : { "cfengine" : "boxlang@1" },
	"scripts" : { "onServerInitialInstall" : "install bx-playwright --noSave" }
}
```

When bx-playwright is missing, or TestBox has no browser support, `browse()`, `visitRoute()`, `loginAs()` and `logout()` **skip** the spec with the reason instead of failing. `routeURL()` works without a browser.

## A Complete Spec

```js
// tests/specs/browser/UsersSpec.bx
class extends="coldbox.system.testing.BrowserTestCase"
	appMapping="/root"
	baseURL="http://127.0.0.1:8080"
	browserProfile="ci"
{

	function run() {
		describe( "Users", () => {

			it( "shows a user profile to a logged in admin", () => {
				browse( ( page ) => {
					loginAs( page, 1 )
					visitRoute( page, "users.show", { id : 5 } )
					assertRouteIs( page, "users.show" )
					expect( page ).toSee( "User 5" )
				} )
			} )

			it( "edits a user and lands back on the profile", () => {
				browse( ( page ) => {
					loginAs( page, 1 )
					visitRoute( page, "users.edit", { id : 5 } )
						.fill( "Name", "Luis" )
						.click( "Save" )
					assertRouteIs( page, "users.show", { id : 5 } )
					expect( page.locator( "h1" ) ).toHaveText( "Luis" )
				} )
			} )

			it( "sends guests to the login page", () => {
				browse( ( page ) => {
					loginAs( page, 1 )
					logout( page )
					visitRoute( page, "users.edit", { id : 5 } )
					assertRouteIs( page, "login" )
				} )
			} )

			it( "keeps an admin and a guest apart", () => {
				// one isolated page (own cookies) per argument
				browse( ( admin, guest ) => {
					loginAs( admin, 1 )
					visitRoute( admin, "admin.dashboard" )
					expect( admin ).toSee( "Dashboard" )
					visitRoute( guest, "admin.dashboard" )
					expect( guest ).notToSee( "Dashboard" )
				} )
			} )

		} )
	}

}
```

## Annotations and Inherited Features

| Annotation | Description |
|---|---|
| `appMapping`, `webMapping`, `configMapping`, ... | The usual `BaseTestCase` annotations: load the virtual app |
| `baseURL` | URL of your **running** app; relative visits and route paths resolve against it. Falls back to the runner `--web-server-url`, then `BX_PLAYWRIGHT_BASEURL` |
| `browserProfile` | bx-playwright profiles, for example `ci` or `ci,mobile` |

Everything browser related is delegated to TestBox's `BrowserSupport`, exactly like `testbox.system.BrowserSpec`:

- `browse( callback, options = {} )`: fresh isolated pages, one per declared argument; kept screenshots, traces and videos attached to failed specs.
- `this.playwright()`: the bundle manager (use `this.`; a bare `playwright()` is the bx-playwright BIF and creates a new, unmanaged manager).
- `browserAvailable()` and `browserUnavailableReason()`: for skip constraints, for example `describe( title = "Checkout", skip = !browserAvailable(), body = () => { ... } )`.
- The browser matchers (`toSee`, `toHaveTitle`, `toHavePath`, `toHaveURL`, `toHaveText`, `toBeVisible`, `toBeHidden`, `toHaveCount`, `toHaveValue` and `not` forms) are registered for every spec.
- One browser per bundle, closed after the bundle by `closeBrowser()` (`@afterAll`, no `super` calls needed). Never use `asyncAll` in suites that browse.

## Named Route Helpers

| Helper | Does |
|---|---|
| `routeURL( name, params = {} )` | Path of a named route (no scheme or host), built by `event.route()`, so it includes the app routing prefix and module entry points. Throws `InvalidArgumentException` for unknown routes |
| `visitRoute( page, name, params = {} )` | `page.visit( routeURL( name, params ) )`; returns the page for chaining |
| `assertRouteIs( page, name, params = {} )` | Waits (bx-playwright `waitForUrl()`, up to `timeouts.assertion`, 5 s default) until the page is on the route; else fails with `TestBox.AssertionFailed` |

```js
routeURL( "users.show", { id : 5 } )   // /users/5/
routeURL( "users.index" )              // /users/
routeURL( "posts@blog" )               // /blog/posts/   module route: name@module
routeURL( "blog:posts" )               // /blog/posts/   module route: module:name
page.visit( routeURL( "search" ) & "?q=coldbox" )

assertRouteIs( page, "users.show" )               // without params: any placeholder value matches the route pattern
assertRouteIs( page, "users.show", { id : 5 } )   // with params: exactly the path of routeURL( name, params )
assertRouteIs( page, "post@blog" )
assertRouteIs( page, "blog:post", { slug : "hello-world" } )
```

`assertRouteIs()` matching rules: ignores case and the trailing slash, ignores the query string and hash, does not match longer paths (`/users/5/posts` is not `users.show`), and honors route constraints.

If the server reaches the app through a different prefix than the virtual app (for example `/index.cfm` without URL rewrites), set it in a `beforeEach()`; only its path is used:

```js
beforeEach( ( currentSpec ) => {
	getRequestContext().setSESBaseURL( "http://127.0.0.1:8080/index.cfm" )
} )
```

## loginAs() and logout()

`loginAs( page, id )` and `logout( page )` call test-only endpoints of the `BrowserTesting` **core module** (`GET /__browser-testing/login/:id` and `GET /__browser-testing/logout`), which run closures **you** provide. The request uses the page context's request API, so it shares the page cookies: the session cookie lands in that page only, and other pages of the same `browse()` keep their own sessions. Both return the page.

### Configure the module (testing environment only)

The module is always registered and **disabled by default**. Enable it only in the `testing()` environment method of your ColdBox config, never in `configure()`:

```js
// config/ColdBox.bx
class {

	function configure() {
		// ...
		variables.moduleSettings = {}
	}

	/**
	 * Only called when the testing environment is detected
	 */
	function testing() {
		variables.moduleSettings.browserTesting = {
			enabled : true,
			token   : getSystemSetting( "BROWSER_TESTING_TOKEN", "" ),
			login   : ( id, event, rc, prc ) => {
				var wirebox = event.getController().getWireBox()
				var user    = wirebox.getInstance( "UserService" ).retrieveUserById( id )
				wirebox.getInstance( "authenticationService@cbauth" ).login( user )
			},
			logout  : ( event, rc, prc ) => {
				event.getController().getWireBox().getInstance( "authenticationService@cbauth" ).logout()
			}
		}
	}

}
```

| Setting | Default | Description |
|---|---|---|
| `enabled` | `false` | Anything but `true` answers 404 |
| `token` | `""` | Shared secret every request must send. Empty disables the endpoints |
| `login` | `""` | Closure `( id, event, rc, prc )`; `id` is the value passed to `loginAs()` |
| `logout` | `""` | Closure `( event, rc, prc )` |

The closures run inside a normal request of the running app: log in any way you like (session variable, cbauth, cbsecurity).

### Security model (read this)

The endpoints log **anyone in as any user**. Every request must pass **all** checks, otherwise it gets a plain `404 Not Found` (like a missing page) and no closure runs:

| Check | Requirement |
|---|---|
| Environment | The app `environment` setting is `testing` |
| Enabled | `enabled` is `true` |
| Token configured | `token` is not empty |
| Token sent | The request sends the same token in the `X-Browser-Testing-Token` header (or a `token` URL/FORM variable), compared in constant time |
| Closure | The `login` or `logout` closure is set |
| Method | GET only |

The checks run in the handler actions on every request, so they also cover convention routes and `event=` executions.

Rules:

- **Never enable the module outside the `testing` environment**, and never set `ENVIRONMENT=testing` on staging or production.
- **Never expose a server running in `testing` where real users can reach it.** Host-based detection such as `testing : "^127\.0\.0\.1"` is only for servers bound to your machine or CI job.
- **Random token per environment, out of source control**: `openssl rand -hex 32`, an environment variable or CI secret.
- `loginAs()` / `logout()` always send the header (headers stay out of access logs, URL variables do not).

The **same token must reach both sides**: the running app (which checks it) and the test runner, whose virtual app `loginAs()` reads `moduleSettings.browserTesting.token` from. Export `ENVIRONMENT=testing` and `BROWSER_TESTING_TOKEN` to both processes; with the HTML runner of the server under test they already share it.

### Errors

Failures throw `BrowserTestCase.BrowserTestingUnavailable` with a setup hint:

| Message mentions | Cause |
|---|---|
| `needs the BrowserTesting core module, which is not loaded` | Module not loaded in the spec's virtual app |
| `moduleSettings.browserTesting.token is empty` | The virtual app has no token: check its environment and `BROWSER_TESTING_TOKEN` |
| `answered 404 Not Found` | The running app refused: module disabled, token mismatch, closure missing, or environment is not `testing` |
| `answered HTTP 500` (or other) | Your closure threw; the response text is included |

## Running the App for the Browser

**CommandBox server** (tests run through the HTML runner of the same server, sharing env vars):

```bash
export ENVIRONMENT=testing
export BROWSER_TESTING_TOKEN=$( openssl rand -hex 32 )
box server start
box testbox run
```

**TestBox BoxLang runner** starts the server, waits for it, runs the tests and stops it. `--web-server-url` also becomes the default `baseURL`. `BrowserTestCase` still loads the app virtually, so the BoxLang OS runtime needs `bx-web-support` (`install-bx-module bx-web-support`).

```bash
./testbox/run --directory=tests.specs.browser \
	--web-server="boxlang-miniserver --port 8080" \
	--web-server-url=http://localhost:8080
```

ColdBox reads the `ENVIRONMENT` variable at startup when your config has no `detectEnvironment()` method.

On CFML engines, exclude the browser folder in `tests/runner.cfm`:

```js
if ( !structKeyExists( server, "boxlang" ) ) {
	url.directoryExcludes = listAppend( url.directoryExcludes, "/browser" );
}
```

## CI (GitHub Actions)

```yaml
jobs:
  browser-tests:
    runs-on: ubuntu-latest
    env:
      ENVIRONMENT: testing           # the app detects its environment from this
      BX_PLAYWRIGHT_PROFILE: ci      # headless, keep artifacts of failures
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: temurin, java-version: "21" }
      - uses: ortus-boxlang/setup-boxlang@main
        with:
          version: latest
          modules: bx-playwright
      - uses: Ortus-Solutions/setup-commandbox@v2.0.1
        with:
          install: commandbox-boxlang
      # A fresh random token per run: nothing to store or leak
      - run: echo "BROWSER_TESTING_TOKEN=$( openssl rand -hex 32 )" >> "$GITHUB_ENV"
      - run: box install
      - name: Install Chromium
        run: |
          export PATH="$HOME/.boxlang/bin:$PATH"
          bxPlaywright install chromium --with-deps
      - name: Start the application
        run: |
          box server start --noSaveSettings
          curl --silent --fail --retry 10 --retry-delay 3 --retry-all-errors http://127.0.0.1:8080 > /dev/null
      - run: box testbox run
      - name: Upload failure artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: browser-test-artifacts
          path: |
            ~/.boxlang/playwright/artifacts
            tests/results
          if-no-files-found: ignore
```

The server inherits `ENVIRONMENT`, `BROWSER_TESTING_TOKEN` and `BX_PLAYWRIGHT_PROFILE`, so the token reaches both sides. Open a downloaded trace with `bxPlaywright show-trace trace.zip`. Never reuse this setup to expose a `testing` server outside the CI runner.

## Related Skills

- `testbox-browser-testing`: BrowserSpec, browser matchers, attachments, retries, `--failed`, `--web-server`, debugging
- `coldbox-testing-base-classes`, `coldbox-testing-integration`, `coldbox-routing-development`
- `modules/cbauth`, `security/authentication`: what to call inside the `login` / `logout` closures
