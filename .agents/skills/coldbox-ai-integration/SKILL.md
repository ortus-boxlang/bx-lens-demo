---
name: coldbox-ai-integration
description: "Use this skill when integrating AI capabilities into a ColdBox application using the BoxLang AI library (bx-ai module) -- including simple chat, streaming (see coldbox-sse-streaming for first-class SSE), pipelines, agents, RAG with vector memory, document loading, tool calling, auto-scaffolding a REST API for an IAiRunnable with route( ... ).toAi(), exposing an AI Gateway over HTTP with route( ... ).toAiGateway() for platform webhooks and human-in-the-loop approvals, and injecting the AI service into handlers or models."
applyTo: "**/*.{bx,bxm,cfc,cfm,cfml}"
---

# AI Integration (BoxLang AI / bx-ai)

## When to Use This Skill

Use this skill when adding AI features to a ColdBox/BoxLang application: chatbots, content generation, code assistance, semantic search (RAG), autonomous agents, or AI-enriched handlers and services.

> Full SDK docs: https://ai.ortusbooks.com/

## Setup

### Install the Module

```bash
box install bx-ai
```

### ModuleSettings (config/ColdBox.cfc)

```javascript
moduleSettings = {
    "bx-ai" : {
        // Default provider: openai, claude, gemini, ollama, etc.
        defaultProvider : "openai",
        providers : {
            openai : {
                apiKey : getSystemSetting( "OPENAI_API_KEY", "" ),
                model  : "gpt-4o"
            },
            claude : {
                apiKey : getSystemSetting( "ANTHROPIC_API_KEY", "" ),
                model  : "claude-opus-4-5"
            },
            ollama : {
                baseUrl : "http://localhost:11434",
                model   : "llama3"
            }
        }
    }
};
```

## Built-In Functions (BIFs) Reference

All BIFs are available globally in BoxLang after installing `bx-ai`:

| BIF | Purpose | Returns |
|-----|---------|---------|
| `aiChat( prompt, options )` | One-shot chat | String |
| `aiChatAsync( prompt, options )` | Non-blocking chat | Future |
| `aiChatRequest()` | Build structured request | AiChatRequest |
| `aiChatStream( prompt, callback )` | Real-time streaming | void |
| `aiService()` | Get AI service instance | Service |
| `aiAgent()` | Create autonomous agent | AiAgent |
| `aiMessage()` | Build message pipeline | AiMessage |
| `aiModel()` | Create model runnable | AiModel |
| `aiTransform()` | Create data transformer | Transformer |
| `aiTool()` | Define callable function | Tool |
| `aiMemory()` | Create conversation/vector memory | Memory |
| `aiDocuments()` | Load documents for RAG | Array/Loader |
| `aiChunk()` | Split text into chunks | Array |
| `aiEmbed()` | Generate vector embeddings | Array/Struct |
| `aiPopulate()` | Populate struct/class from AI JSON | Any |
| `aiTokens()` | Estimate token count | Numeric |

## Common Patterns

### Simple Chat

```boxlang
// Basic Q&A
var answer = aiChat( "What is ColdBox?" )

// With options
var answer = aiChat(
    "Write a product description for: #rc.productName#",
    {
        temperature : 0.7,
        model       : "gpt-4o",
        provider    : "openai"
    }
)

// Return structured JSON
var user = aiChat(
    "Create a user profile for Alice, age 30, developer",
    { returnFormat: "json" }
)
// user.name, user.age, user.email etc.
```

### Streaming Responses

```boxlang
// Stream to a closure (useful for server-sent events)
aiChatStream(
    "Tell me about BoxLang in detail",
    ( chunk ) => {
        var token = chunk.choices?.first()?.delta?.content ?: ""
        print( token )
    }
)
```

### Async Chat

```boxlang
// Non-blocking — returns a Future
var future = aiChatAsync( "Summarize this article: #rc.articleText#" )
// Do other work...
var summary = future.get( 30, "seconds" )
```

## Using AI in Handlers

```boxlang
// handlers/ContentHandler.bx
class ContentHandler extends coldbox.system.EventHandler {

    @inject("AIService@bx-ai")
    property name="aiService";

    function summarize( event, rc, prc ) {
        prc.summary = aiChat(
            "Summarize the following in 3 bullet points: #rc.content#",
            { temperature: 0.3 }
        )
        event.setView( "content/summary" )
    }

    // Streaming via first-class SSE (ColdBox 8.2.0+) — see coldbox-sse-streaming skill
    function streamSummary( event, rc, prc ) {
        event.sse( ( emitter ) => {
            aiChatStream(
                "Summarize: #rc.content#",
                ( chunk ) => {
                    var token = chunk.choices?.first()?.delta?.content ?: ""
                    if ( len( token ) && emitter.isOpen() ) {
                        emitter.send( token, "token" )
                    }
                }
            )
        } )
    }
}
```

> On ColdBox 8.1 and earlier (no `event.sse()`), stream plain text manually with
> `event.renderData( type: "plain", data: "" )` followed by `writeOutput()`/`flushOutput()` inside
> the `aiChatStream()` callback — this is not real SSE framing, just a chunked plain-text response.
> `toAi()`'s own `/stream` sub-route (below) is the preferred way to stream a runnable's output and
> already uses proper SSE framing regardless of ColdBox version.

## AI Pipelines

Pipelines chain message templates, models, and transformers for reusable, parameterized AI workflows:

```boxlang
// Build a reusable pipeline
var pipeline = aiMessage()
    .system( "You are a helpful ColdBox expert. Answer concisely." )
    .user( "Explain ${topic} with a short code example in BoxLang." )
    .toDefaultModel()
    .transform( ( result ) => result.content )

// Execute the pipeline with parameters
var answer = pipeline.run( { topic: "interceptors" } )

// Reuse with different params
var answer2 = pipeline.run( { topic: "scheduled tasks" } )
```

## Tool Calling (Function Calling)

Allow AI to call your application functions to get real-time data:

```boxlang
// Define a tool
var getProductTool = aiTool(
    name        : "get_product",
    description : "Get product information by SKU",
    parameters  : {
        sku : { type: "string", description: "Product SKU code" }
    },
    callback : ( args ) => {
        var product = productService.findBySku( args.sku );
        return {
            name        : product.getName(),
            price       : product.getPrice(),
            inStock     : product.isInStock()
        };
    }
)

// Use the tool in a chat request
var response = aiChat(
    "Is product SKU-1234 in stock and what is the price?",
    { tools: [ getProductTool ] }
)
```

## Memory & Conversation Context

```boxlang
// Windowed memory (last N messages) — in-memory
var memory = aiMemory( type: "windowed", size: 10 )

// Session memory — survives page refresh
var memory = aiMemory( type: "session" )

// Multi-tenant — use userId + conversationId for isolation
var memory = aiMemory(
    type           : "windowed",
    size           : 20,
    userId         : auth().getUser().getId(),
    conversationId : rc.conversationId
)

// Use memory in chat
var response = aiChat( rc.userMessage, { memory: memory } )

// Vector memory for semantic RAG
var vectorMemory = aiMemory( type: "boxvector" )  // in-memory vector store
// or: type: "postgres", type: "chroma", type: "pinecone", etc.
```

## RAG (Retrieval-Augmented Generation)

```boxlang
// Load documents
var docs = aiDocuments( source: expandPath( "/docs/manual.md" ) )

// Also supports PDFs, HTML, URLs, CSV, SQL, directories
var docs = aiDocuments( source: "https://docs.ortussolutions.com/coldbox/" )
var docs = aiDocuments( source: expandPath( "/docs/" ) )  // directory loader

// Store in vector memory
var vectorMemory = aiMemory( type: "boxvector" )
vectorMemory.addDocuments( docs )

// Query with context-aware chat
function askDocs( event, rc, prc ) {
    prc.answer = aiChat(
        rc.question,
        { memory: vectorMemory }
    )
    event.renderData( data: { answer: prc.answer } )
}
```

## AI Agents

Autonomous agents with memory, tools, and multi-turn conversation:

```boxlang
// Create an agent
var assistant = aiAgent()
    .name( "ColdBox Support Assistant" )
    .instructions( "You help developers build ColdBox applications. Use the provided tools to look up docs and examples." )
    .memory( aiMemory( type: "windowed", size: 20 ) )
    .tools( [ searchDocsTool, getExampleTool ] )
    .provider( "claude" )

// Multi-turn conversation
var response1 = assistant.chat( "How do I create an interceptor?" )
var response2 = assistant.chat( "Can you show me a security example?" )  // remembers context
```

## Exposing a Runnable as a REST API — `toAi()`

*ColdBox 8.1.0+. BoxLang only; requires `bxai`.*

`route( ... ).toAi( runnable )` is the AI equivalent of `resources()` — one line scaffolds a
complete, standardized REST API for any `IAiRunnable`:

```boxlang
// config/Router.cfc
class Router extends coldbox.system.web.routing.Router {

    function configure() {
        // WireBox ID, resolved lazily at request time
        route( "/api/chat" ).toAi( "MyChatAgent" )

        // Or a live instance
        route( "/api/embeddings" ).toAi( getInstance( "EmbeddingRunnable" ) )
    }

}
```

That registers four endpoints: `POST {base}/invoke` (synchronous), `POST {base}/stream` (SSE),
`POST {base}/batch` (parallel array of `inputs[]`), and `GET {base}/info` (self-describing
metadata). An `IAiRunnable` implements `run( input, params, options )` and, for streaming,
`stream( input, params, options )`:

```boxlang
// models/MyChatAgent.bx
class implements="bxai.models.ai.IAiRunnable" {

    function run( input, params, options ) {
        return aiChat( input, { temperature: params.temperature ?: 0.7 } )
    }

    function stream( input, params, options, callback ) {
        aiChatStream( input, callback )
    }

}
```

**ColdBox 8.2.0+ — conversational context.** The `invoke`/`stream`/`batch` endpoints resolve
`userId`, `conversationId`, and `threadId` from the request body and thread them into `options`:

```boxlang
// POST /api/chat/invoke  { "input": "hi", "threadId": "t-123" }
// → run( "hi", {}, { userId: "<session id>", threadId: "t-123" } )
// → { "output": ..., "success": true, "threadId": "t-123" }

function run( input, params, options ) {
    var reply = aiChat( input, { memory: aiMemory(
        type           : "windowed",
        userId         : options.userId,
        conversationId : options.conversationId ?: options.threadId
    ) } )
    return reply
}
```

`threadId` is generated when not supplied by the caller and is **always** echoed back — in the
JSON response, an `X-Thread-Id` header, and (since browser `EventSource` clients can't read
response headers) a leading `event: thread` SSE frame on `/stream`. `userId` defaults to the
framework's session/request tracking identifier; `conversationId` is only set when the caller
supplies it — no default is invented.

> See the [`coldbox-routing-development`](../routing-development/SKILL.md) skill for route naming
> and modifier inheritance (auth conditions, domains, SSL) shared with `toMCP()` and
> `toAiGateway()`.

## Exposing an Agent to a Platform — AI Gateways

*ColdBox 8.2.0+. BoxLang only; requires `bxai`.*

An **AI Gateway** is the bridge between an external messaging platform (Slack, Teams, a custom
webhook) and one of your agents. ColdBox mounts one over HTTP with a single routing terminator:

```boxlang
// config/Router.cfc
class Router extends coldbox.system.web.routing.Router {

    function configure() {
        // One mount serving every gateway in aiGatewayRegistry()
        route( "/gateways" ).toAiGateway( session: "SupportAgentSession" )

        // Or pin the mount to one gateway
        route( "/webhooks/slack" ).toAiGateway( "slack", "SupportAgentSession" )
    }

}
```

That registers everything a gateway surface needs:

| Verb | Pattern | Purpose |
|---|---|---|
| `GET`/`POST` | `{pattern}[/:gateway]/events` | URL-verification handshake (GET) and inbound events (POST) |
| `GET` | `{pattern}/interactions/:requestID` | Poll a pending human-in-the-loop interaction |
| `POST` | `{pattern}/interactions/:requestID/decisions` | Submit a human's decision |
| `GET` | `{pattern}/info` | Which gateways this mount serves |

GET and POST share `/events` because a platform is given **one** URL and verifies it with a GET
before it ever POSTs to it.

### With a session — inbound messages become agent turns

Pass `session` (a WireBox ID, or a live `GatewaySession` from `aiGatewaySession()`) and every
inbound message is dispatched as an agent turn and acked **`202` immediately**, without waiting
for the turn to finish. This matters: a platform webhook times out in seconds, an agent turn does
not. The response reports which thread each message landed on so the later reply can be
correlated.

```boxlang
// models/SupportAgentSession.bx — the session behind the mount
class singleton {

    function init() {
        variables.session = aiGatewaySession( "support" )
        return this
    }

}
```

```boxlang
// Or hand the router a live session directly
route( "/gateways" ).toAiGateway( session: aiGatewaySession( "support" ) )
```

### Without a session — verify and parse only

Omit `session` and the route verifies the platform's signature and normalizes the payload, then
hands the messages back for the application to dispatch itself. Use this when you want to queue
the work, fan it out, or apply your own routing before an agent sees it.

```boxlang
route( "/gateways" ).toAiGateway()
```

> `toAiGateway()` throws at **route-registration time** on a non-BoxLang runtime, or when `bxai`
> is missing — you find out at startup, not on the first webhook. See the
> [`coldbox-routing-development`](../routing-development/SKILL.md) skill for route naming,
> inherited modifiers, and `buildLink()` against the sub-routes.

## Document Processing (RAG Loaders)

| Loader | Source |
|--------|--------|
| Text / Markdown | `.txt`, `.md` files |
| HTML | `.html` files or URLs |
| PDF | `.pdf` files |
| CSV / JSON / XML | Structured data files |
| SQL | JDBC datasource + query |
| Directory | Scan folder recursively |
| Web Crawler | Follow links on a site |
| HTTP | Any URL with auth/headers |
| Feed | RSS/Atom feeds |

```boxlang
// Multi-source ingestion into one vector store
var memory = aiMemory( type: "boxvector" )
memory
    .addDocuments( aiDocuments( source: expandPath( "/docs/" ) ) )
    .addDocuments( aiDocuments( source: "https://docs.example.com" ) )
```

## Embeddings

```boxlang
// Generate embeddings for semantic similarity
var embeddings = aiEmbed([
    "ColdBox is an HMVC framework",
    "WireBox is a dependency injection framework",
    "TestBox is a testing framework"
])

// Single text
var embedding = aiEmbed( "How does WireBox injection work?" )
```

## Key Rules

- Install `bx-ai` via CommandBox: `box install bx-ai` — this is a BoxLang module, not a CFML module.
- All BIFs (`aiChat`, `aiAgent`, etc.) are available globally in BoxLang after installation.
- Use `aiChatAsync()` for background processing; never block the HTTP request with long AI calls.
- Use `aiMemory( type: "session" )` for per-user chat history tied to the HTTP session.
- Use `aiMemory( type: "windowed" )` with explicit `userId` + `conversationId` for multi-tenant isolation.
- For production RAG, prefer a persistent vector store (`postgres`, `pinecone`, `qdrant`) over `boxvector` (in-memory only).
- Configure providers and API keys via environment variables, not hardcoded values.
- Scaffold a REST API for a runnable with `route( ... ).toAi()` (ColdBox 8.1.0+) rather than hand-building invoke/stream/batch/info endpoints yourself.
- Pass `threadId` through `toAi()`'s conversational context (ColdBox 8.2.0+) to correlate multi-turn conversations instead of inventing your own session key.
- Expose agents to external platforms with `route( ... ).toAiGateway()` rather than hand-rolling webhook handlers — it registers the handshake, events, interactions and info routes together (ColdBox 8.2.0+).
- Always pass a `session` to `toAiGateway()` when inbound messages should reach an agent; without one the route only verifies and parses.
- See https://ai.ortusbooks.com/ for the full SDK reference including advanced agents, sub-agents, and MCP integration.
