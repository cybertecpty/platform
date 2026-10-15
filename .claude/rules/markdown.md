---
paths:
  - '**/*.md'
---

# Writing Markdown

Moved here from `docs/agents/conventions.md` §8. Loads when editing Markdown.

## Documentation placeholders

In shell/bash code blocks, use `{placeholder}` or `[placeholder]`, **not** `<...>` —
shells read `<`/`>` as redirection and a copy-paste can error or clobber a file. Keep
placeholder style consistent across a block.

## Prettier owns Markdown

Its normalization is **not** configurable:

- Emphasis (italic) uses single underscores; strong (bold) uses double asterisks.
  Write `_word_`, not `*word*` — `*word*` gets rewritten to `_word_` on the next
  format run. (Prettier keeps `*` only for mid-word emphasis like `a*b*c`, which
  prose rarely wants.)
- Unordered list bullets are `-` (Prettier rewrites `*` / `+`).
