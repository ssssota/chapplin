# Motivation

## Background

Before discussing the motivation, let's review the overview of MCP Apps and OpenAI ChatGPT Apps.

1. Both are fundamentally MCP servers
2. MCP Apps and ChatGPT Apps are applications built on top of MCP
3. MCP has the concepts of tools and resources
4. Applications are displayed as a result of tool invocations
5. UIs are provided as resources and built with HTML/CSS/JS

## Challenges

Developing MCP Apps and ChatGPT Apps presents the following challenges:

1. Tool invocation results are linked to resources, but since they are separate concepts, each must be implemented individually
2. Being separate makes the build process complex
3. Implementing them individually makes it difficult to share type information from tool invocation responses with the UI
4. MCP Apps and ChatGPT Apps have slightly different specifications, making dual support cumbersome

## How chapplin Solves These

chapplin addresses these challenges by:

1. **Unified definition with `defineTool`**: Tools and their corresponding UIs can be defined together in a single place, eliminating the conceptual separation
2. **Integrated build system**: The Vite plugin handles both MCP server and client UI builds seamlessly
3. **Type-safe communication**: Since tools and UIs are defined together, TypeScript type information flows naturally from tool responses to UI components
4. **Abstraction layer**: chapplin abstracts the differences between MCP Apps and ChatGPT Apps, allowing developers to write once and deploy to both platforms
