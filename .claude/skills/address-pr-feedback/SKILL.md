---
name: address-pr-feedback
description: >
  Work through an automated reviewer's comments on a platform PR (GitHub Copilot or Gemini
  Code Assist) — triage each thread (fix or reasoned pushback), push accepted fixes, then
  resolve ONLY the threads that were actually fixed. Declined/deferred threads stay open
  with a reply. Use when asked to address PR review feedback / bot review comments.
---

# Address PR review feedback

## Goal

Triage each automated-reviewer thread on a PR, apply a fix or post a reasoned pushback, then
mark **only the fixed threads** resolved. Declined/deferred threads stay **open** with a
reply for the human — nothing gets silently dismissed. "Address PR feedback" includes the
GitHub thread-resolution writes; do them unless the user explicitly opts out.

Reviewers seen on this repo:

| Reviewer           | First comment `author.login`         |
| ------------------ | ------------------------------------ |
| GitHub Copilot     | `copilot-pull-request-reviewer[bot]` |
| Gemini Code Assist | `gemini-code-assist[bot]`            |

Step 2 discovers the actual thread authors before filtering — surface any login not in this
table rather than skipping it.

## Preconditions

- Inside the `platform` clone. `OWNER=cybertecpty`, `REPO=platform`.
- This is agent work on a PR → follow [`docs/agents/conventions.md`](../../../docs/agents/conventions.md)
  §1: commit as `cybertec-bot`, push via the `cybertec-bot` remote onto the **same PR
  branch**, resolve threads under the bot account.
- Working tree clean. Never stash/reset carryover you didn't create (conventions §5).

## Workflow

### 1. Resolve the PR and reviewer filter

Args: an all-digits token is the PR number (default: the current branch's PR); a token of
`copilot` / `gemini` / `all` is the reviewer filter (default `all`).

```bash
PR="{n or $(gh pr view --json number --jq .number)}"
gh pr view "$PR" --repo cybertecpty/platform --json number,headRefName,url --jq '{number,headRefName,url}'
gh pr checkout "$PR"   # if not already on the branch
```

### 2. Fetch review threads (GraphQL — REST can't see resolve state)

```bash
gh api graphql -f query='
query($owner:String!,$repo:String!,$pr:Int!){
  repository(owner:$owner,name:$repo){ pullRequest(number:$pr){
    reviewThreads(first:100){ nodes{
      id isResolved isOutdated path line
      comments(first:20){ nodes{ databaseId author{login} body url } }
    }}
  }}
}' -F owner=cybertecpty -F repo=platform -F pr="$PR"
```

Group **unresolved** threads by first-comment `author.login` and report counts. Keep threads
whose author matches a known reviewer bot (prefix match tolerates `[bot]`), narrowed to the
reviewer filter if one was given. Ignore human authors and non-reviewer bots. If zero
matching open threads, say so and stop.

For each kept thread note: `id` (node ID for resolve), first comment `databaseId` (for the
reply endpoint), `path`, `line`, `body`, reviewer. Flag `isOutdated`.

### 3. Triage each thread

One todo per thread. For each: read the comment and the code at `path:line` plus enough
context (nearby implementation, tests, schemas, any generated-output contract) to judge.
Then:

- **Fix** — reviewer is right (or close enough). Make the minimal scoped change. Update all
  related surfaces for an option/flag/schema change, and make import + first-usage edits
  atomic for the format-on-save hook (conventions §8).
- **Decline** — reviewer is wrong / non-issue. No code change. Reply explaining why. Leave open.
- **Defer** — legitimate but out of scope or the human's call. Reply saying so. Leave open.

Be candid, not deferential — automated reviewers raise plenty of false positives. A reasoned
"intentional because X" is a valid outcome.

### 4. Reply to threads (threaded, keyed by the first comment's databaseId)

```bash
gh api "repos/cybertecpty/platform/pulls/$PR/comments/{comment_id}/replies" -f body="{explanation}"
```

Fixed threads: an optional "Fixed in {short-sha}." Declined/deferred: a reply is **required**
(the audit trail for why it stays open).

### 5. Commit, verify, push (only if step 3 produced code changes)

```bash
npm exec nx test {project}
npm exec nx run-many -t build -p {affected}   # when compilation could be affected; CI doesn't run build on PRs to develop only if... check conventions §9
git -c user.name="cybertec-bot" -c user.email="cybertec-bot@cybertec.io" commit -F /tmp/msg.txt
git push cybertec-bot HEAD
```

Report verification results honestly. Do not force-push.

### 6. Resolve ONLY the fixed threads

```bash
gh auth switch --user cybertec-bot
gh api graphql -f query='mutation($t:ID!){ resolveReviewThread(input:{threadId:$t}){ thread{ id isResolved } } }' -F t={thread-node-id}
# repeat per fixed thread
gh auth switch --user djmcgrath101
```

Verify each returns `isResolved: true`. Never resolve a declined/deferred thread. Always
switch back to the maintainer at the end, even on failure.

## Response format

```markdown
**PR review feedback — PR #{n}** ({branch})

| #   | Reviewer | File:line | The point  | Action                           | Thread |
| --- | -------- | --------- | ---------- | -------------------------------- | ------ |
| 1   | Copilot  | foo.ts:42 | {one line} | Fixed (resolved)                 | {link} |
| 2   | Gemini   | baz.ts:88 | {one line} | Deferred (open, replied) — {why} | {link} |

**Verification:** {results}
**Commit/push:** {short-sha} pushed to {branch} via cybertec-bot.

PR: https://github.com/cybertecpty/platform/pull/{n}
```

## Constraints

- Resolve only what you fixed. Every declined/deferred thread gets a reply — no silent dismissals.
- Never push to `develop`/`main`; never self-merge. Fixes land on the PR's feature branch.
- Keep diffs minimal and scoped to the comments.
- Leave `gh` at `djmcgrath101` at rest.
