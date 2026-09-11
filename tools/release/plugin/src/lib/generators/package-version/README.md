# `package-version` Generator

Updates the `version` field in an existing `package.json` using either an explicit semantic version or a semver release type bump.

## What It Does

- Reads an existing `package.json` from the provided path.
- Sets `version` directly when `vers` is a valid semantic version such as `2.0.0`, writing its normalized form (`v2.1.0` becomes `2.1.0`).
- Bumps the current version when `vers` is a release type such as `major`, `minor`, or `patch`.
- Preserves the position of the `version` field in the JSON object when rewriting the file.
- Throws when the target `package.json` does not exist.
- Throws when a release-type bump is requested but the current package version is invalid.
- Throws when `vers` is neither a valid semantic version nor a known release type.
- Formats files unless `--skipFormat` is provided.

## Usage

```bash
pnpm nx g @cybertecpty/release-plugin:package-version <path-to-package-json> <version-or-release-type> [options]
```

## Options

- `path` (string, required unless passed positionally): Path to the target `package.json`, relative to the workspace root.
- `vers` (string, required): New version value. Supports explicit semantic versions and these release types: `major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch`, `prerelease`.
- `skipFormat` (boolean, default `false`): Skip formatting updated files.

## Examples

```bash
# Set an explicit version
pnpm nx g @cybertecpty/release-plugin:package-version libs/tools/package.json 2.0.0

# Bump the current version by release type
pnpm nx g @cybertecpty/release-plugin:package-version libs/tools/package.json minor
```
