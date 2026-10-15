# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## The `ready-for-agent` bar

"Fully specified" means the issue has all of these — the sections of the
[task template](../../.github/ISSUE_TEMPLATE/task.yml):

1. **Problem** — the need, not just a proposed fix.
2. **Acceptance criteria** — a checklist where each item is testable: a reviewer can tick it
   from the diff, a test, or a command's output. "Works well" or "clean up X" is not a criterion.
3. **Out of scope** — stated, even if "None".
4. **Open questions** — none left. Each is answered in the body or a maintainer comment.
5. **ADR question decided** — not needed, or the ADR / amendment is named as part of the work
   (`write-adr` skill has the test). "Undecided" does not pass.

An issue missing any of these is `needs-info`, not `ready-for-agent`. An agent that picks up
such an issue anyway fills the gap before coding — `conventions.md` §3, "Acceptance criteria".
