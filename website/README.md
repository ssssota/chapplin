# Chapplin Documentation Website

This is the official documentation website for Chapplin, built with [Astro](https://astro.build) and [Starlight](https://starlight.astro.build).

[![Built with Starlight](https://astro.badg.es/v2/built-with-starlight/tiny.svg)](https://starlight.astro.build)

## 🚀 Project Structure

```
website/
├── public/              # Static assets (favicon, logo)
├── src/
│   ├── assets/         # Image assets
│   └── content/
│       └── docs/       # Documentation pages
│           ├── index.mdx
│           ├── guides/
│           │   ├── getting-started.md
│           │   └── frameworks.md
│           └── reference/
│               └── api.md
├── astro.config.mjs    # Astro & Starlight configuration
└── package.json
```

## 🧞 Commands

All commands are run from the website directory:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |

## 📝 Documentation Structure

### Getting Started
- **Introduction** (`index.mdx`) - Overview of Chapplin
- **Quick Start** (`guides/getting-started.md`) - First application tutorial

### Guides
- **Framework Integration** (`guides/frameworks.md`) - Use with Hono, Express, React, etc.

### Reference
- **API Reference** (`reference/api.md`) - Complete API documentation

## 📚 Learn More

- [Starlight Documentation](https://starlight.astro.build/)
- [Astro Documentation](https://docs.astro.build)
- [Chapplin Repository](https://github.com/ssssota/chapplin)
