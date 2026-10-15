---
name: write-adr
description: >
  Decide whether a decision in platform needs an Architecture Decision Record, and write or
  amend one in docs/adr/. Use when a change picks between real alternatives (a tool, a layout,
  a runtime, a policy), when an issue or PR asks "does this need an ADR?", or when asked to
  write, amend, or supersede an ADR.
---

# Write or amend an ADR

Moved here from `docs/agents/conventions.md` §7, which keeps the durable-knowledge rules.

## When a decision needs an ADR

Write a new ADR, or amend an existing one, when a decision meets **all three** of these:

1. **It's a real choice.** There were credible alternatives and one was picked
   (Jest over Vitest, the flat `apps/` layout).
2. **It's costly to reverse, or many projects depend on it.** Changing it later
   means touching many projects or people's habits.
3. **The reason won't be obvious from the code.** Someone reading the code later
   would ask "why this?" and could undo it without knowing.

An issue tracks a piece of work and is closed when the work is done. An ADR records
why something is done a certain way and stays in force afterwards. Work that only
applies existing ADRs (e.g. a generator that enforces ADR 0009/0010 placement)
needs no new ADR: cite the ADRs it applies in the issue. When an issue makes a
decision that meets the test, say in the issue which ADR records it.

## Writing it

- Read the ADRs that touch the area first (`docs/agents/domain.md`). If the decision contradicts
  one, say so explicitly and amend or supersede it rather than silently overriding it.
- Copy the structure of a recent ADR in `docs/adr/` (numbered `NNNN-kebab-title.md`, next free
  number): the header list (Status, Date, Deciders, Implemented by), then Context and problem
  statement, Decision drivers, Considered options, Decision outcome (with Locked parameters when
  there are any), Consequences, More information.
- An amendment adds a dated section to the existing ADR and says what changed; it doesn't rewrite
  the original decision text.
