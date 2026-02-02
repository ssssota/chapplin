# Architecture

chapplin consists of a build system provided as a Vite plugin and a runtime library that operates at execution time.

## Build System

The build system, implemented as a Vite plugin, follows Vite's architecture to build MCP servers and bundle clients. Additionally, it provides a development UI server during development.

### Build

UIs need to be served as HTML from MCP server resources. Since we want to build independently of the runtime, UIs are built internally with Vite. Using vite-plugin-singlefile, the UI is compiled into a single HTML file and then exported as a JavaScript module in the form `export default "<!doctype><html>...</html>"`.

### Development Server

During development, Vite's development server provides two UIs for the development workflow:

1. **Preview iframe**: The actual UI that will be rendered, displayed inside an iframe
2. **Console UI**: A development interface that allows you to interact with and manipulate the iframe (e.g., simulating tool calls, inspecting state)

## Runtime Library

The runtime library can be divided into a server-side part and a client-side part.
Basically, only the `defineTool` function is provided, within which you write code for both server and client.

### Server

The server-side `defineTool` constructs the information needed to provide tools to the MCP server. The described UI is transformed into a format that can be registered as a resource.

### Client

The client-side part primarily consists of a layer that abstracts differences between UI frameworks such as React, Preact, Solid.js, and Hono.
This is also written within `defineTool`, allowing you to build UIs with JSX.
