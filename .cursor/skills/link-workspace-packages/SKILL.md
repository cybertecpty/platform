---
name: link-workspace-packages
description: 'Link workspace packages in this pnpm monorepo. USE WHEN: (1) you just created or generated new packages and need to wire up their dependencies, (2) user imports from a sibling package and needs to add it as a dependency, (3) you get resolution errors for workspace packages (@org/*) like "cannot find module", "failed to resolve import", "TS2307", or "cannot resolve". DO NOT patch around with tsconfig paths or manual package.json edits - use pnpm''s workspace commands to fix actual linking.'
---

# Link Workspace Packages

Add dependencies between packages in this monorepo. This workspace uses **pnpm** — packages are
declared with the `workspace:` protocol and symlinked only when explicitly added.

## Workflow

1. Identify the consumer package (the one importing)
2. Identify the provider package(s) (being imported)
3. Add the dependency with pnpm's workspace syntax
4. Verify symlinks were created in the consumer's `node_modules/`

## Add a workspace dependency

```bash
# From the consumer's directory
pnpm add @org/ui --workspace

# Or from anywhere, with --filter to target the consumer
pnpm add @org/ui --filter @org/app --workspace
```

Result in the consumer's `package.json`:

```json
{ "dependencies": { "@org/ui": "workspace:*" } }
```

Add several at once:

```bash
pnpm add @org/data-access @org/ui --filter @org/dashboard --workspace
```

Then run `pnpm install` to materialise the links.

## Debug "Cannot find module"

1. Check the dependency is declared in the consumer's `package.json`
2. If not, add it with the command above
3. Run `pnpm install`
4. Confirm the symlink exists at `<consumer>/node_modules/@org/<package>`

## Notes

- pnpm does not hoist — its strict, isolated `node_modules` prevents phantom dependencies, so a
  package must declare everything it imports.
- The root `package.json` has `"private": true` to prevent accidental publishing.
