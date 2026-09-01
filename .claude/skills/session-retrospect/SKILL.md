---
name: session-retrospect
description: >
  End-of-session retrospective — capture the durable lessons from this session and route
  each to its correct home (memory / CLAUDE.md / ADR / GitHub issue). Sweeps the whole
  session, filters durable lessons from transient noise, runs a scoped doc-drift check on
  anything the session changed, and proposes every write for approval before making it. Use
  when asked to retrospect, reflect on the session, do a post-mortem, or "what did you learn".
---

# Session retrospect

Capture the **durable lessons** from this session and route each to the correct home, so the
next session starts faster and repeats fewer mistakes.

**Proposes every write and waits for approval.** Never silently writes files.

## What it is / is not

- **IS:** a whole-session sweep for lessons visible only in aggregate (a repeated mistake, a
  convention learned the hard way, a workflow friction worth encoding), routed to a durable home.
- **IS NOT** `anthropic-skills:consolidate-memory` — that _tidies_ the existing pool (dedup,
  prune, fix stale facts). This one _captures new_ lessons. If the pool needs tidying,
  recommend running that separately.

## The bar

Most of a session is transient troubleshooting and **must not** be recorded. Keep a candidate
only if it is **durable** — it would change how a _future_ session works:

- A repo convention / constraint / gotcha not yet written down.
- A working-style preference or correction the user gave.
- An architectural decision with a real alternative that was weighed.
- Pending/deferred work that must outlive this session.
- A reusable reference (URL, dashboard, issue, command incantation).

Drop everything else. When in doubt, **drop it** — a noisy pool is worse than a sparse one.

## Routing

| Lesson kind                                             | Home                                             | Memory pointer?    |
| ------------------------------------------------------- | ------------------------------------------------ | ------------------ |
| Repo convention / agent working rule                    | `CLAUDE.md` or `docs/agents/conventions.md`      | optional one-liner |
| Architectural decision (alternative weighed)            | new ADR in `docs/adr/` + index row               | optional           |
| Open / pending / deferred work                          | a GitHub issue (see below)                       | short pointer only |
| Local setup / run instructions                          | co-located `README.md`                           | optional           |
| Personal working-style preference, identity, correction | **memory only** (`feedback` / `user`)            | this is its home   |
| External resource pointer                               | memory (`reference`) and/or the doc that uses it | yes                |

Constraints (do not violate):

- Repo-relevant conventions/decisions/pending-work land in a checked-in doc, **not** memory
  alone. Memory keeps a one-line pointer.
- Personal/transient facts stay **memory-only** — never committed to the repo.
- If memory and a committed doc disagree, the **committed doc wins** — fix the memory.
- Before a new memory file, check `MEMORY.md` + the likely file and propose an **update** instead.

Memory location: the running session's own memory dir, from the session context
(`{claude-home}/projects/{project-slug}/memory/`). One fact per file with frontmatter
(`type: user | feedback | project | reference`); index line in that dir's `MEMORY.md`.
Prefix project-scoped names `platform-…`.

## Pending work → a GitHub issue

Deferred work becomes a GitHub issue on `cybertecpty/platform` (see
[`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md)), added to the
**Platform · Foundation** project board. Prefer the `mattpocock-skills:to-tickets` skill for
anything that is more than a single well-scoped issue (vertical slices + blocking edges); use
a single `mcp__github__issue_write` create call otherwise. An issue _is_ the durable record —
creating it here is the completed action, no later commit step.

## Workflow

### 1. Sweep the session

Review from the top. Collect raw candidates — mistakes and their root cause, corrections the
user gave, conventions/gotchas hit, decisions taken, work left open. Don't filter yet.

**Scoped drift check (only if a repo was modified this session).** For each doc that
_describes_ something this session changed (`CLAUDE.md`, `docs/agents/*.md`, `README.md`,
`docs/adr/`), re-verify the claims **about what changed** against the actual filesystem/git,
read-only — the way `audit-drift` does, but scoped to this session's changes only. Any drift
joins the candidate list. If the session touched no repo, skip.

### 2. Filter against the bar

Discard transient candidates. For survivors, write a one-line statement in the user's terms
(for feedback/project kinds, add "why" + "how to apply").

### 3. Route and de-dup

For each survivor, find its home from the table. For memory lessons, read `MEMORY.md` (+ the
related file) to decide new vs. update. For repo-doc lessons, locate the exact file + section.
For pending work, decide issue type and a proposed Priority. Note lessons needing writes in
**two** places (a convention → doc _and_ a memory pointer).

### 4. Present the plan, get approval

Show a compact table **before writing anything**:

| #   | Lesson (one line) | Destination | New/Update |
| --- | ----------------- | ----------- | ---------- |

Also list what you considered and **dropped**, so the user can pull anything back. Then ask
for approval (`AskUserQuestion` if a routing choice is genuinely ambiguous, else a plain
"approve all / edit which?"). **Do not write until approved.**

### 5. Write the approved entries

- **Memory files** — write the file, then add/refresh its one-line pointer in `MEMORY.md`.
- **Repo docs** (`CLAUDE.md` / `docs/agents/*` / ADR / `README.md`) — checked-in changes.
  Edit them, then ship via the bot flow: if on a protected branch, branch off `develop`,
  commit as `cybertec-bot`, push via `cybertec-bot`, open a PR
  (`.claude/skills/commit-push-pr`). **Never** append to a branch/PR opened earlier this
  session without first confirming it is still open (`gh pr view {n} --json state,mergedAt`)
  — a merged PR's branch is auto-deleted and a later push silently strands a ref.
- **Pending-work issues** — create with `mcp__github__issue_write` (or `to-tickets`).

### 6. Close out

Summarize what was written and where — commit hash / branch / PR for doc edits, number+URL
for issues. Flag a `consolidate-memory` pass **only** on a concrete trigger: the pool exceeds
~20 files, `MEMORY.md` is past ~70% of budget, this retrospect added/updated 3+ memories, or
the sweep noticed stale/duplicative/contradictory entries. Otherwise say nothing.

## Guardrails

- Propose before writing — always. No silent file creation.
- High bar — prefer dropping a marginal lesson over recording noise.
- No duplicates — update existing entries.
- Respect the memory/doc split — conventions to checked-in docs, personal facts to memory only.
- Stay in your lane — this skill captures; it does not refactor code, tidy the whole memory
  pool, or start the next phase of work.
