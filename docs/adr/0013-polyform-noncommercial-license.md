# 13. PolyForm Noncommercial license and a CLA

- Status: accepted
- Date: 2026-10-13
- Deciders: djmcgrath
- Implemented by: PR #105 (`LICENSE.md`, `package.json` `license`) and PR #107 (`CLA.md`,
  `CONTRIBUTING.md`, PR template)

## Context and problem statement

The repo was private and had no license file, while the root `package.json` said `MIT`. The
owner plans to make it public. The owner wants to stop others from monetizing the code, and
to keep the right to charge for a subscription product later.

An earlier plan (July 2026) would have published it under BUSL-1.1. It was paused with five
open decisions: licensor entity, Change Date, Change License, the Additional Use Grant, and
npm package licensing.

Which license fits, who owns it, and how are outside contributions handled?

## Decision drivers

- No one else may monetize the code, permanently.
- The owner keeps the right to sell it, or run it as a subscription, later.
- Prefer an existing standard text over a custom license, so counsel can review it quickly.
- Few open parameters to decide.
- The owner has to be able to relicense outside contributions, or the subscription option is
  lost for any code others write.

## Considered options

1. **PolyForm Noncommercial 1.0.0.**
2. **BUSL-1.1** (the earlier plan).
3. **Functional Source License (FSL).**
4. **MIT, as `package.json` claimed.**
5. **Proprietary, all rights reserved, with the source private.**

## Decision outcome

Chosen option: **1 — PolyForm Noncommercial 1.0.0.**

- Option 2 and option 3 convert to an open source license after a fixed period (at most four
  years for BSL, two for FSL), after which anyone can monetize that version. That conflicts
  with "permanently". BSL also restricts production use, not monetization, so the
  Additional Use Grant would need custom drafting for counsel.
- Option 4 allows anyone to sell the code.
- Option 5 gives the most control but loses the source-available signal and outside review.
- PolyForm Noncommercial restricts commercial use for everyone but the licensor, has no
  conversion date, and has only one parameter to fill in, the copyright line.

### Locked parameters

- **Licensor:** Cyber Technologies Development & Consulting, S.A., a Panamanian
  corporation. `LICENSE.md` carries it as the `Required Notice` line.
- **License text:** the PolyForm Noncommercial 1.0.0 text, unmodified apart from formatter
  whitespace. SPDX identifier `PolyForm-Noncommercial-1.0.0` in the root `package.json`.
- **Source-available, not open source.** It is not OSI approved, so do not describe the repo
  as "open source".
- **Commercial use is the licensor's alone.** A subscription, a hosted offering or a paid
  commercial license is not blocked by this license: it binds licensees, not the copyright
  holder. This holds only while the licensor owns, or holds relicensing rights to, all the
  code.
- **Outside contributions need the CLA** (`CLA.md`, an individual CLA modeled on the Apache
  ICLA). Contributors keep their copyright and grant the licensor a perpetual, irrevocable
  copyright and patent license, including the right to relicense under any terms.
  `CONTRIBUTING.md` explains it, and the PR template has an agreement checkbox.
- **New project licenses.** A new published package defaults to the root license. A different
  license for a specific project needs an amendment to this ADR.

## Consequences

### Positive

- Others can read, run and modify the code for noncommercial purposes. Companies using it
  commercially need a license from the owner.
- The subscription option stays open, and the CLA keeps it open for outside code.
- A standard text with one parameter, so counsel review is short.

### Negative / risks

- Free noncommercial use covers self-hosting by individuals, students and nonprofits. Anyone
  in those groups can run the code instead of paying for a subscription.
- Releases already distributed stay licensed under the terms their recipients received.
  Changing the license later affects only new versions.
- "Noncommercial" has gray areas, such as a hobbyist running ads. The license text decides, and
  disputes would need a lawyer.
- Source-available code may reduce contributions and cannot be bundled with some open source
  projects.
- The CLA is enforced by a PR checkbox only. There is no automated signature record, and no
  corporate CLA for company contributors.
- The CLA was drafted from a standard template. It is not yet reviewed against Panamanian
  law, in particular the moral-rights waiver and the employer clause.

### Open items (not decided here)

- Counsel confirms the licensor owns all existing code, meaning an assignment from the
  author to the company.
- Whether to enforce CLA signatures automatically (for example a CLA-assistant GitHub
  Action), and whether to draft a corporate CLA.
- npm publishing: whether `restricted` becomes `public`, and what license the published
  packages carry. A source-available license on npm may be unwelcome to some consumers.
- Making the repo public: a git-history secret scan, a review of what `.github/` and `docs/`
  would expose, and a check of fork-PR workflow triggers.
- Other `package.json` files that set their own `license` field.

## More information

- [`LICENSE.md`](../../LICENSE.md), [`CLA.md`](../../CLA.md) and
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md).
- PolyForm Noncommercial 1.0.0: <https://polyformproject.org/licenses/noncommercial/1.0.0>
- The repo is still private. This ADR records the license choice, not the visibility change.
- This is not legal advice. Have counsel review before going public.
