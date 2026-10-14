# 14. Agentic development workflow

- Status: proposed
- Date: 2026-10-14
- Deciders: djmcgrath
- Implemented by: `docs/agents/conventions.md`, `docs/agents/principles.md`, `.claude/skills/`,
  rulesets `protect-develop` / `protect-main`, `.github/CODEOWNERS`

## Context and problem statement

Most code in this repo is written by coding agents (Claude Code) working under one human
maintainer. The mechanics are documented in `docs/agents/`, but the decision behind them was never
recorded: why agents commit under a separate identity, why a human gate sits on every merge, and
where agent knowledge is allowed to live. Without a record, each rule reads as arbitrary and is easy
to erode one convenience at a time (a force-push, a bypass actor, a note kept only in memory).

This ADR records the model as it exists today so it can be challenged or changed deliberately.

**Scope assumption: a solo maintainer.** The repo has one human, `djmcgrath101`, who directs the
agents, is the sole approver, the sole CODEOWNER, and the only admin. There are no other
maintainers or human reviewers. Copilot review is supported but is not automated (see Review
loop). The model is built for that setting, and several of its trade-offs (below) follow from it.

## Decision drivers

- **Attribution.** Agent-authored work must be distinguishable from the maintainer's own in
  `git log`, PRs, and comments.
- **Human gate.** No agent output reaches `develop` or `main` without the maintainer's approval.
- **Least privilege.** The agent identity gets the minimum GitHub access that lets it do the job.
- **Durability.** Knowledge the repo depends on must survive a fresh clone, a new machine, and a
  new session.
- **Concurrency safety.** Several sessions can run against one clone; none may corrupt another's
  work.
- **Traceability.** Issue → branch → PR → commit should be a clean, scannable trail.

## Considered options

1. **Agents act as the maintainer** (shared identity, direct pushes or self-approved PRs).
2. **Bot identity authors; the maintainer approves and merges** (chosen).
3. **Bot identity authors and self-merges** under a bypass actor, with after-the-fact review.

## Decision outcome

Chosen option: **2 — a dedicated bot identity authors and proposes; the maintainer is the only
approver.**

- Option 1 erases the line between agent and human work, so attribution and the review gate both
  depend on discipline alone.
- Option 3 removes the gate that makes agent autonomy safe. Branch protection can enforce the gate
  instead of trusting behavior, so the bot is deliberately given no bypass.
- Option 2 puts the gate in GitHub itself: protection rules enforce it, not agent behavior.

### Locked parameters

**Identity and access**

- Agent commits and PRs are authored by `cybertec-bot`, a member of the `cybertecpty/bots` team
  with `write` on the repo. Commits use explicit `-c user.name/user.email` flags; the repo's
  `.git/config` user is never changed.
- Agents push via the `cybertec-bot` remote (SSH alias), never `origin`.
- `gh` rests on the maintainer account between sessions. It switches to `cybertec-bot` before any
  bot-attributed write and back at session end.
- The GitHub MCP server authenticates as the **maintainer**. Agents use it for reading (diffs,
  threads, CI, issues, search) and for creating backlog issues. They do **not** use it to commit,
  push, open or merge PRs, comment, or resolve threads on bot-authored work.

**Branches and merging**

- One issue → one branch → one PR into `develop` (ADR 0002). Coupled-issue exceptions are
  deliberate, and dependent work waits for the base PR to _merge_.
- `develop` and `main` are protected: PR required, one maintainer approval, passing `ci`, all
  review threads resolved, no force-push or deletion. The maintainer (admin) is the only bypass.
- The bot arms `gh pr merge --auto --squash`. That only pre-arms the merge; it still waits on CI
  and the maintainer's approval. The bot is never granted bypass rights, and if it loses
  authorization for a protected branch the agent reports it rather than working around it.
- Reviewer routing is double-covered: `.github/CODEOWNERS` auto-requests the maintainer, and the
  agent passes `--reviewer` explicitly. "Required" is not "requested."

**Review loop**

- Only humans and `copilot-pull-request-reviewer[bot]` feedback is actionable. Bot-authored
  comments and CI-status noise are skipped. Fixes are pushed, and only threads that were actually
  fixed are resolved (`address-pr-feedback` skill).
- Copilot review is **opt-in, not enforced**: no ruleset rule or workflow requests it, so it runs
  only when the maintainer requests it on a PR (a seated-account action).

**Backlog**

- Work is tracked in GitHub Issues with the five-role triage vocabulary; agent-ready work is
  labelled `ready-for-agent`. Issues are created through the `to-tickets` skill (vertical slices,
  blocking edges) rather than ad hoc.

**Sessions and knowledge**

- Sessions on one clone share a working tree. Agents never stash, checkout, reset, or delete
  state they did not create, and prefer pushing a committed branch without checking it out.
- At a major phase shift, the agent proposes a fresh session after capturing a durable handoff.
- Durable knowledge lives in checked-in docs: conventions in `docs/agents/`, decisions in
  `docs/adr/`, pending work in issues. Memory holds only short pointers; committed docs win on
  conflict.
- Working principles (mark unknowns, disagree when warranted, no silent scope changes, be
  concise, treat context as a budget) are in `docs/agents/principles.md` and are authoritative.

## Consequences

### Positive

- Every agent change is attributable and passes a human gate enforced by GitHub, not by agent
  self-restraint.
- A compromised or misbehaving agent session cannot push to `develop` / `main` or approve its own
  work.
- The workflow is reproducible from the repo alone: a fresh clone and a new agent get the same
  rules.

### Negative / risks

- **Throughput is bounded by one human reviewer.** Every PR waits on the maintainer; auto-merge
  only removes the final click.
- **Account juggling is error-prone.** A write made while `gh` is on the wrong account is
  mis-attributed. Mitigated by the `commit-push-pr` skill, which switches before `gh pr create`.
- **Two GitHub identities per agent session** (bot for writes, maintainer via MCP for reads) is
  subtle, and the MCP boundary is convention, not enforcement.
- **Single point of failure:** the maintainer is the only approver and only bypass actor.
- **No independent human check.** The approver is also the person directing the agents, so the
  gate catches agent mistakes but not the maintainer's own blind spots. Copilot review could
  partly substitute, but it is opt-in and, as of this ADR, no merged PR has received one.

### If a second maintainer or reviewer joins

The core pattern (bot author, protected branches, human approval, MCP read/write split) does not
depend on there being one reviewer and carries over unchanged. What would change:

- add the new reviewer(s) to `.github/CODEOWNERS` and to the approver set;
- reconsider the required approval count (currently one) and whether to enable
  `require_code_owner_review`;
- add a second bypass actor so the maintainer is no longer the only admin;
- revisit the "maintainer account via GitHub MCP" boundary, since the MCP identity would no
  longer be the only human.

Making any of these changes supersedes this section and should be recorded as an amendment.

- Some conventions describe tooling not yet live (see `conventions.md` §0), so docs can drift
  ahead of reality. `audit-drift` exists to catch that.

## More information

- `docs/agents/conventions.md` §1 (identity, PR mechanics, MCP boundary), §2 (branch model,
  protection), §3 (issue/PR workflow), §4 (reviews), §5–§7 (concurrency, sessions, durable
  knowledge).
- `docs/agents/principles.md`, `issue-tracker.md`, `triage-labels.md`, `domain.md`.
- ADR 0002 — `develop` as default branch; ADR 0011 — release flow (agent-driven release
  generator under the same protection model).
- `.claude/skills/`: `commit-push-pr`, `address-pr-feedback`, `audit-drift`, `session-retrospect`.
