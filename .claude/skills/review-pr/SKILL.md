---
name: review-pr
description: >
  Review priorities and comment style for reviewing a platform PR, branch, or diff. Use when
  asked to review code in this repo, alongside any generic code-review skill, so findings are
  ranked by this repo's priorities.
---

# Review a platform PR

Moved here from `docs/agents/conventions.md` §10.

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
