# nx-testing

Test helpers for specs of Nx plugins and workspace utilities (`type:testing`, ADR 0004): import
from `*.spec.ts` only, never from production code.

This lib must not import `@cybertecpty/nx-utils`. `nx-utils` specs import this lib, so the reverse
import would make a project-graph cycle, and lint won't catch it: module-boundary checks are off
in spec and fixture files (ADR 0008).

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `nx test nx-testing` to execute the unit tests via [Jest](https://jestjs.io).
