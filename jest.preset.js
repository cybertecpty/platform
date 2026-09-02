const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  // `nx run-many` / `nx affected -t test` sweep every project; some legitimately
  // have no unit tests (type:types libs, freshly scaffolded or barrel-only libs).
  // Whether a runtime lib *should* have tests is a code-review concern, not the
  // runner's exit code. A broken testMatch also passes green now — a coverage
  // threshold, not this flag, is the guard against that.
  passWithNoTests: true
};
