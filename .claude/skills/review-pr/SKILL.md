---
name: review-pr
description: >
  Review priorities and comment style for reviewing a platform PR, branch, or diff. Use when
  asked to review code in this repo, alongside any generic code-review skill, so findings are
  ranked by this repo's priorities.
---

# Review a platform PR

Moved here from `docs/agents/conventions.md` §10.

## How much review

Scale review effort to risk, not to habit. Pick the tier from the **riskiest path the diff
touches** — not its line count — and state it in the PR's Test plan
(`Review: light — docs only`).

| Tier         | The diff touches                                                                                                                                                                                                                                                                                   | Review                                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **None**     | Markdown only                                                                                                                                                                                                                                                                                      | No automated review. `pnpm verify` (format check) plus the maintainer's read.                                             |
| **Light**    | App or lib code that its own tests cover; internal refactors                                                                                                                                                                                                                                       | One pass by the authoring agent against the priorities below (`code-review` at `low`). No subagents. **The default.**     |
| **Standard** | A lib other projects import (`libs/shared/**`, `tools/*/utils/**`); a new dependency; `project.json` / `tsconfig*.json` / `nx.json`; more than ~400 changed lines of hand-written code                                                                                                             | `code-review` at `medium`, one reviewer.                                                                                  |
| **Deep**     | Generators and executors (`tools/*/plugin/**`); CI workflows and scripts (`.github/workflows/**`, `.github/scripts/**`); agent tooling that runs on its own (`.claude/hooks/**`, `.claude/settings.json`); ESLint config and module-boundary rules; release tooling; auth, secrets, deploy targets | `code-review` at `high`, or the parallel standards + spec review (`mattpocock-skills:code-review`). Never a bigger fleet. |

- **Mixed diffs** take the highest tier any touched path calls for.
- **Escalate one step, not to the top.** A Light review that finds a real bug moves to Standard;
  it doesn't justify a many-agent sweep.
- **Ultra** (`/code-review ultra`) is the maintainer's call — it's user-triggered and billed.
  Agents never launch it.
- The maintainer can always ask for a higher tier.
- Review subagents are read-only and share the worktree under review. If one applies fixes
  it gets its own worktree (`commit-push-pr`, Splitting work across
  subagents).

## Priorities

First, check the PR against its issue's acceptance criteria (`conventions.md` §3) —
`gh issue view {n} --comments` for the issue the PR closes. Every criterion is ticked in the PR
body with evidence the diff actually provides, unticked ones carry a reason or a follow-up issue,
and the diff does not wander into the issue's "Out of scope". A criterion ticked without evidence,
or scope creep, is a finding. If the issue has no testable criteria, say so — the PR's scope
can't be checked.

Then, in order:

1. Architecture / module-boundary violations — changes that don't fit the Nx
   workspace structure, cross-boundary imports that violate scope/tag rules, new
   top-level packages that bypass placement conventions, duplicated helper logic
   where a shared helper should be extended.
2. Correctness, security, trust-boundary bugs — bad conditionals, off-by-one,
   unhandled edge cases, unhandled rejections, swallowed exceptions, missing
   validation of external input. Extra scrutiny on auth, query construction, and
   secrets. Prefer the repo's Zod request contracts at the API edge.
3. Missing/inadequate test coverage for changed behavior.
4. Generator changes that update only part of the required surface
   (`.claude/rules/generators.md`).
5. Maintainability — anything that leaves a confusing handoff.

Comment style: point at the exact line, explain why it matters, match severity to
impact. Skip formatting/import-order/quote-style trivia handled by Prettier/ESLint.
If a change establishes a new durable pattern or tradeoff, ask whether it belongs in
an ADR (`write-adr` skill).
