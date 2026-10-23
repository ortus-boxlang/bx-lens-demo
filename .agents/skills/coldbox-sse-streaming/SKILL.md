---
name: coldbox-sse-streaming
description: "Use this skill when streaming Server-Sent Events (SSE) from a ColdBox handler or route with event.sse(), building a route that always streams with Router.toSSE(), sending data/events/errors through an SSEEmitter, reacting to SSE connect/disconnect/error via the preSSEConnection/postSSEConnection/onSSEError interception points, or configuring the this.sse settings block (keep-alive interval, reconnect hints, CORS defaults)."
applyTo: "**/*.{bx,bxm}"
---

# Server-Sent Events (SSE)

## When to Use This Skill

Use this skill when a ColdBox application needs to push a stream of events to the browser over a
single long-lived HTTP response — live notifications, progress updates, log tailing, ticking
dashboards, or streaming AI chat responses. For request/response AI streaming specifically via
`toAi()`'s `/stream` sub-route, see [`coldbox-ai-integration`](../ai-integration/SKILL.md); this
skill covers first-class SSE as a general-purpose ColdBox feature.

> **ColdBox 8.2.0+. BoxLang only.** `event.sse()`, `Router.toSSE()`, and the SSE interception points
> all require BoxLang; they are not available on Lucee or Adobe ColdFusion engines.

## Core Concepts

- **`event.sse( callback )`** — takes over the response and hands your callback an `SSEEmitter`
- **`SSEEmitter`** — `send()`, `sendView()`, `sendData()`, `sendError()`, keep-alives, disconnect detection
- **`Router.toSSE()`** — a route terminator for endpoints that *always* stream, mirroring `toResponse()`
- **Interception points** — `preSSEConnection` (reject before it opens), `postSSEConnection`
  (observe stream completion), `onSSEError` (react to mid-stream errors)
- **`this.sse` settings** — keep-alive interval, reconnect hints, CORS defaults, set per-handler or globally

## Streaming from a Handler

```boxlang
class Notifications extends coldbox.system.EventHandler {

    function ticker( event, rc, prc ) {
        event.sse( ( emitter ) => {
            while ( emitter.isOpen() ) {
                emitter.send( { "ts": now() }, "tick" )
                sleep( 1000 )
            }
        } )
    }

}
```

`event.sse()` takes over rendering entirely — do not also call `event.setView()` or
`event.renderData()` in the same action.

## The `SSEEmitter` API

```boxlang
function stream( event, rc, prc ) {
    event.sse( ( emitter ) => {

        // Send a plain data payload (defaults to the "message" event name)
        emitter.send( "hello" )

        // Send structured data with an explicit event name
        emitter.send( { "progress": 42 }, "progress" )

        // Alias for data-only payloads
        emitter.sendData( { "userId": 123, "action": "login" } )

        // Render a view fragment and stream its output as one SSE frame
        emitter.sendView( view: "partials/notification", args: { message: "New order!" } )

        // Send an error frame (does not close the stream by itself)
        emitter.sendError( "Something went wrong", "error" )

        // Check the connection before writing — the browser may have disconnected
        if ( !emitter.isOpen() ) {
            return
        }

    } )
}
```

### Detecting Disconnects

Always gate long-running loops on `emitter.isOpen()` — the client can close the connection (tab
closed, navigation, network drop) at any point, and writing to a closed emitter is wasted work:

```boxlang
function longRunningExport( event, rc, prc ) {
    event.sse( ( emitter ) => {
        for ( var row in exportService.streamRows() ) {
            if ( !emitter.isOpen() ) {
                break // client disconnected — stop producing work
            }
            emitter.sendData( row )
        }
    } )
}
```

## Streaming Routes — `Router.toSSE()`

For an endpoint that *always* streams, register it directly on a route instead of writing a
one-line handler action — `toSSE()` mirrors `toResponse()`:

```boxlang
// config/Router.cfc
class Router extends coldbox.system.web.routing.Router {

    function configure() {
        route( "/notifications/stream" ).toSSE( ( event, rc, prc, emitter ) => {
            while ( emitter.isOpen() ) {
                emitter.send( notificationService.next(), "notification" )
            }
        } )
    }

}
```

Route modifiers chained before `toSSE()` (`withCondition`, `withDomain`, `withSSL`, headers, and so
on) are inherited the same way they are for `toResponse()`/`toAi()`/`toAiGateway()`.

## SSE Interception Points

```boxlang
class SSEAuditInterceptor extends coldbox.system.Interceptor {

    function preSSEConnection( event, rc, prc, interceptData ) {
        // Reject the connection before it opens by short-circuiting (return true)
        if ( !auth.isLoggedIn() ) {
            event.setHTTPHeader( statusCode: 401 )
            return true
        }
        log.info( "SSE connection opened: #event.getCurrentEvent()#" )
    }

    function postSSEConnection( event, rc, prc, interceptData ) {
        // Fires once the stream completes (client disconnected or the callback returned)
        log.info( "SSE connection closed: #event.getCurrentEvent()#" )
    }

    function onSSEError( event, rc, prc, interceptData ) {
        // interceptData.exception holds the error that broke the stream
        log.error( "SSE stream error: #interceptData.exception.message#" )
    }

}
```

Register it like any other interceptor in `config/ColdBox.cfc`:

```boxlang
interceptors = [
    { class: "interceptors.SSEAuditInterceptor", name: "SSEAuditInterceptor" }
]
```

## The `this.sse` Settings Block

Configure keep-alive interval, reconnect hints, and CORS defaults globally in `config/ColdBox.cfc`,
or override per-handler with `this.sse` on the handler component:

```boxlang
// config/ColdBox.cfc
class ColdBox extends coldbox.system.Coldbox {

    function configure() {
        coldbox.sse = {
            keepAliveInterval : 15,             // seconds between keep-alive comments
            retry             : 3000,           // ms — sent as the SSE "retry:" reconnect hint
            cors              : {
                allowOrigin : "https://app.example.com"
            }
        }
    }

}
```

```boxlang
// handlers/Notifications.bx — per-handler override
class Notifications extends coldbox.system.EventHandler {

    this.sse = {
        keepAliveInterval : 30
    }

    function ticker( event, rc, prc ) {
        event.sse( ( emitter ) => {
            while ( emitter.isOpen() ) {
                emitter.send( { "ts": now() }, "tick" )
                sleep( 1000 )
            }
        } )
    }

}
```

## SSE Best Practices

- Always check `emitter.isOpen()` inside loops — a disconnected client should stop your work, not just stop being written to
- Never call `event.setView()`/`event.renderData()` in the same action as `event.sse()` — the emitter owns the response
- Use `preSSEConnection` for auth/authorization checks before a long-lived connection is established, not inside the streaming callback
- Use `onSSEError` for centralized error logging/alerting rather than try/catch inside every streaming action
- Tune `keepAliveInterval` below any intermediary proxy's idle-connection timeout to prevent silent disconnects
- Prefer `Router.toSSE()` over a handler action when the endpoint has no other responsibility besides streaming
- For AI-generated streaming output specifically, prefer `toAi()`'s `/stream` sub-route (see [`coldbox-ai-integration`](../ai-integration/SKILL.md)) over hand-rolling `event.sse()` plus `aiChatStream()`
