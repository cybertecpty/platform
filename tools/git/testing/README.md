# git-testing

Test helpers for specs that need real git (`type:testing`, ADR 0004): import from `*.spec.ts` only,
never from production code.

- `createGitRepoFixture()` makes a throwaway repository on `main` in a temp directory, with a local
  identity and signing off. It returns the directory, a `simple-git` client, a `commit(message)`
  helper that adds an empty commit and returns its hash, and a `cleanup()` to call in `afterEach`.

This lib must not import `@cybertecpty/git-utils`. `git-utils` specs import this lib, so the reverse
import would make a project-graph cycle, and lint won't catch it: module-boundary checks are off in
spec and fixture files (ADR 0008).

## Running unit tests

Run `nx test git-testing` to execute the unit tests via [Jest](https://jestjs.io).
