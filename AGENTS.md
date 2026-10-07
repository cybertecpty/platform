<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with pnpm (e.g., `pnpm exec nx build`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

## Agent conventions & principles

How coding agents work in this repo — git identity & PR flow, branch model, review handling,
concurrency, testing, Nx rules — is documented in `docs/agents/conventions.md`. General working
posture (mark unknowns, disagree when you should, no silent scope changes, be concise, keep the
context lean) is in `docs/agents/principles.md`. Both are authoritative for this repo. Read them
before any commit, push, PR, or scaffolding task.

Companion docs: `docs/agents/issue-tracker.md` (GitHub Issues workflow),
`docs/agents/triage-labels.md` (triage vocabulary), `docs/agents/domain.md` (`CONTEXT.md` /
`docs/adr/`).
