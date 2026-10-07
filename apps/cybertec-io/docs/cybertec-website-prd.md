# CyberTec Website — Product Requirements Document

> ⚠️ **Vendored design-phase artifact — architecture superseded by [ADR 0012](../../../docs/adr/0012-astro-content-sites.md).**
> This PRD is kept in-repo for its **structure, final copy, design tokens, and
> acceptance criteria** — not its stack/build guidance. The marketing site ships as
> **Astro + Tailwind CSS v4** (per ADR 0012), **not** Angular / Angular Material.
> Read every Angular-specific reference below — "Path B (Angular)", NgRx,
> `mat.theme()` / MD3 theming, `@angular/ssr` prerender, and the stack / definition-of-done
> lines — as its Astro/Tailwind equivalent: design tokens map to Tailwind
> `@theme` tokens + CSS custom properties (see
> `src/styles/global.css`), and "prerender" means Astro's static build output.
> For **branding** (colors, type, design tokens, copy), this PRD and the design
> handoff are **canonical** and the shipped app mirrors them — a token change lands
> here first (e.g. `--blueprint` was revised to `#273D4B`). The app is authoritative
> only for non-branding **implementation detail**. WCAG AA conformance for specific
> token pairings (copper-on-Blueprint, Steel-on-Ink) is an open item tracked in the
> accessibility pass (#61).

**Version:** 2.2 — **Phase-1 contractor site, reconciled to the shipped Astro build**
**Date:** June 2026 (v2.2 reconciled to the shipped site, October 2026)
**Prepared by:** Claude (Anthropic) for CyberTec
**Status:** Reflects the site as shipped in `apps/cybertec-io` (copy in §7, stack in §12). The site is built; §14 lists what is still open.
**Domain:** cybertec.io · **Repo/org:** github.com/cybertecpty

**Reconciliation note (v2.2).** v2.2 updates this PRD to match the shipped site: the contractor-focused copy in §7 (availability pill, services, five principles, rewritten roles, "Working with me" strip, contracting entities), the expanded stack in §5, and the Astro + Tailwind v4 build in §9 and §12. Where §8–§13 still describe the original Angular approach, read them as superseded by §9 and §12.

**Reconciliation note (v2.0 → v2.1).** v2.0 repositioned the site to a Phase-1 contractor profile but used placeholder copy and a heavier technical stack. This version reconciles to the **actual high-fidelity design produced in Claude Design** (the bundle: `design-handoff-README.md`, `CyberTec Homepage.reference.html`, the `assets/`). Final decisions applied here:

- **Stack (superseded).** v2.1 specified Angular + Angular Material. The site ships as **Astro + Tailwind v4** (ADR 0012); **no NgRx**; **contact form dropped**.
- **Contact = mailto + links** (`contact@cybertec.io`, GitHub, LinkedIn) — exactly as the design has it. With no form, the Azure **Function, Turnstile, and honeypot are all removed**.
- **English-only, dark-primary only** (carried from v2.0). Spanish copy remains parked for Phase 2.
- **Copy was final at v2.1**, taken from the built design; v2.2 §7 now records the shipped copy. This also closes prior open items O1 (no rate shown — availability pill only) and O2 (real Experience copy exists).

> **`design-handoff-README.md` is authoritative for pixel-level detail** (exact spacing, type sizes, hover states, the blueprint grid). This PRD captures structure, final copy, tokens, the Angular/Material build approach, and deployment. Where they overlap, the README wins on visual specifics.

**Related documents:** `design-handoff-README.md` (pixel spec) · `CyberTec Homepage.reference.html` (open in a browser for the live reference) · `CyberTec-Design-Guide-v2.md` (brand/strategy) · Brand Guidelines / Design Brief / Fonts Reference (identity) · `assets/` (mark SVGs, favicon, `daniel.jpg`) · `cybertec-site-copy-es.md` (**parked** Spanish copy, Phase 2) · boutique HTML (Phase 2).

---

## 1. Problem statement

Daniel McGrath — a senior full-stack engineer (Angular specialist, 15+ years) operating as CyberTec — is pursuing remote contract/freelance work via marketplaces and direct contracts. Evaluators (hiring managers, technical leads, recruiters) need one owned surface that presents him as a serious, low-risk senior hire: skills, proof, and how to reach him, all scannable in seconds. The contested "CyberTec" name makes owning cybertec.io in search important too. The site must read as craft — not a faceless agency, not a hypey freelancer.

## 2. Goals

1. **Convert interest into a hiring conversation.** Primary action: the visitor emails via the "Hire me" / "Get in touch" CTA. The CTA recurs and always leads to the contact section.
2. **Be scannable in ~15 seconds.** Role, stack, seniority signals (15+ yrs, remote, UTC-5, US citizen, bilingual), contracting terms, and contact, all quickly graspable.
3. **Read as a low-risk senior hire** — first-person, direct, proven by real experience and clear principles.
4. **Render the brand faithfully** — warm-dark, architectural, craft; never generic dark-SaaS.
5. **Fast, accessible, durable** — Lighthouse ≥95; WCAG 2.2 AA; cheap to run; evolvable toward the Phase-2 boutique framing.

## 3. Non-goals (Phase 1)

1. **No contact form** — mailto + GitHub/LinkedIn only (no backend, no spam surface).
2. **English only** — Spanish deferred to Phase 2 (copy parked).
3. **No theme switcher** — dark (Ink) primary, fixed; Paper/Blueprint are section surfaces, not a light theme.
4. **No portfolio / "Selected Work"** — the real **Experience** section carries proof.
5. **No boutique "we" framing, no 匠 origin story on the page** — the mark appears quietly in nav + footer only.
6. **No NgRx / app-state library, no blog/CMS, no client portal.** Static marketing page.

## 4. Target users

Hiring managers, technical leads, CTOs, and recruiters evaluating Daniel for a senior contract/freelance engagement — plus marketplace/recruiter screening. They want, fast: the role, the stack, evidence of how he works and what he's shipped, and a frictionless way to reach him. Keyboard/screen-reader users must have full access.

## 5. Real facts (résumé — as shipped)

- **Daniel McGrath** — Senior Full-Stack Engineer and **Angular consultant & contractor**, 15+ years.
- **Panama (remote, UTC-5)** · **US citizen** · English & Spanish.
- **B.S. Information Studies, Florida State University (FSU).**
- **contact@cybertec.io** · **github.com/cybertecpty** · **linkedin.com/in/djmcgrath101**.
- Contracting entities: **CyberTec LLC (US)** — C2C, W-9 · **Cyber Technologies Development & Consulting, S.A. (Panama)**.
- Engagements: long-term, full-time remote contracts; full overlap with US Eastern and Central hours.
- Portrait: `src/assets/daniel.jpg` (square).
- Roles: TeachTown — Frontend Engineer (Contract), 2023–2026; PEMCO — Full-Stack Developer & IT Manager, 2006–2022.
- Stats: 15+ years · 100k+ users · end-to-end ownership.
- **Displayed stack:**
  - Frontend — Angular 5–21, AngularJS, Signals, Standalone Components, NgRx, RxJS, Angular Material, Angular CDK, Web Components, Accessibility (WCAG/ARIA), Capacitor, PWA, Tailwind CSS, Bootstrap
  - Backend — Node.js, Express.js, Firebase, ASP.NET Core, Azure, REST APIs
  - Languages — TypeScript, JavaScript, C#, SQL, PHP, HTML5, CSS3, SASS
  - Databases — Microsoft SQL Server, MySQL, NoSQL (Firebase)
  - Tooling — Nx, Git / GitHub, GitHub Actions, Docker, Jest, Jasmine, Vitest, Cypress, Playwright, Postman, OpenAPI/Swagger, Figma, Jira, CI/CD, Agile / Scrum
  - AI Tools — Claude Code, OpenAI Codex, GitHub Copilot, Google Gemini

> Note: NgRx, Cypress, ASP.NET Core, etc. appear in the **content** (skills + per-role history); the **site itself** is Astro + Tailwind with no client framework. Experience tags list the tech actually used in each role.

## 6. Information architecture

Single scrolling page, English only, dark-primary. Sticky header. Anchors as built:

| #   | Section          | Anchor        | Surface                                     |
| --- | ---------------- | ------------- | ------------------------------------------- |
| 0   | Sticky header    | —             | Ink, blurred, brass hairline                |
| 1   | Hero             | `#top`        | Ink + subtle blueprint grid                 |
| 2   | How I help       | `#services`   | Ink                                         |
| 3   | Stack & tooling  | `#skills`     | **Paper**                                   |
| 4   | How I work       | `#principles` | Ink                                         |
| 5   | Experience       | `#experience` | Ink, top brass hairline                     |
| 6   | About            | `#about`      | Ink + subtle blueprint grid                 |
| 7   | Working with me  | — (no anchor) | Ink, top brass hairline; compact fact strip |
| 8   | Contact / footer | `#contact`    | **Blueprint**                               |

Nav (mono, uppercase): **How I help → `#services` · Stack → `#skills` · How I work → `#principles` · Experience → `#experience` · About → `#about`**, then a **Hire me** button → `#contact` and a GitHub icon link. (Nav labels intentionally differ from section headings but map to these anchors.) Below `lg` the nav collapses to a `<details>` disclosure menu.

## 7. Section-by-section (final copy — as shipped)

> Copy below mirrors the shipped components. Headlines are Fraunces with exactly one **italic-copper accent** (marked _like this_). Eyebrows are IBM Plex Mono, uppercase, letterspaced.

### 7.1 Hero (`#top`)

- **Availability pill** (copper dot + brass border): "Available for long-term remote contract engagements"
- **Eyebrow** (copper): "Senior Full-Stack Engineer · Angular Consultant & Contractor"
- **Headline:** "I build production software, _made to last_."
- **Subhead:** "I'm Daniel McGrath — a senior full-stack engineer and Angular consultant with 15+ years shipping production applications, modernizing legacy frontends, and managing Nx monorepos. Available for long-term, full-time remote contract engagements — from platforms serving hundreds of thousands of users to systems I've owned end to end."
- **CTAs:** primary copper "Get in touch →" → `#contact`; secondary brass "See my work" → `#experience`.
- **Credibility strip** (mono, Steel, slash-separated): 15+ Years / Remote · Panama (UTC-5) / US Citizen / English & Spanish.

### 7.2 How I help (`#services`, Ink) — eyebrow "01 — How I can help"

Three cells (hairline-gap grid), each a copper mono kicker + Fraunces title + body:

- **Build — Full-stack contractor work:** "Building scalable Angular frontends backed by Node.js, Express, Firebase, ASP.NET Core, and SQL databases. I take complete ownership of the full-stack slice, from architecture through deployment and long-term maintenance."
- **Modernize — AngularJS to Angular migration:** "Moving legacy systems off AngularJS, outdated Angular versions, and older stacks onto modern Angular (Signals, Standalone Components) and Nx monorepos — incrementally, without freezing your product roadmap or disrupting active developer workflows."
- **Consult — Angular consulting & Nx monorepos:** "Hands-on Angular consulting on architecture, Nx monorepo setup, NgRx state management, testing strategy, and accessibility. I also mentor developers new to Angular so the team establishes clean, maintainable patterns that outlast the engagement."

### 7.3 Stack & tooling (`#skills`, **Paper**) — eyebrow "02 — Stack & tooling"

- **Headline:** "The tools I reach for, _day to day_."
- Skill-group grid; each group = Ink-tinted mono label + wrapped chips (Ink text, faint Ink border on Paper). Groups and items are listed in §5 (Frontend, Backend, Languages, Databases, Tooling, AI Tools).

### 7.4 How I work (`#principles`, Ink) — eyebrow "03 — How I work"

- **Headline:** "What it's like to _work with me_."
- Five cards (roman-numeral brass label + Fraunces title + body); auto-fit grid, do **not** hard-cap columns:
  - **I. Tame the complexity** — "Complexity is the real enemy — not bug count. I build deep modules behind simple interfaces, keeping the system easy to reason about and safe to change as it grows."
  - **II. Speak the language of the problem** — "Good software starts with understanding the business, not the tech. I learn how your team actually talks about the domain and model it in that language — so the code and the conversation stay in sync."
  - **III. No surprises** — "Clear communication, honest estimates, and steady updates. You'll always know where things stand — and you'll hear the hard truth before it becomes an expensive one."
  - **IV. Leave it better than I found it** — "I'm usually working in code someone else wrote, under real constraints. I improve what I touch — a little cleaner, a little safer each pass — without demanding a rewrite to do it."
  - **V. Pragmatism over dogma** — "Principles serve the project, not the other way around. I know when good-enough is the right call and ship real value on real deadlines — the craft is in the judgment, not in gold-plating."

### 7.5 Experience (`#experience`, Ink) — eyebrow "04 — Experience"

- **Headline:** "A track record of _shipped, maintained_ software."
- **Stats** (Fraunces copper number + mono caption): **15+** Years building production software · **100k+** Users on platforms I've built for · **End‑to‑end** Ownership — architecture through upkeep.
- **Role 1 — 2023–2026 · TeachTown · Frontend Engineer (Contract).** Summary: "Full-time contract frontend engineer on an EdTech platform serving hundreds of thousands of students across thousands of schools." Body: "Engineered the redevelopment of a core curriculum navigation system with NgRx, architected a new observational assessment system, and pioneered the migration to an Nx monorepo. Migrated legacy AngularJS features to modern Angular and designed a custom router integration that let new Angular views run inside legacy ASP pages — without disrupting live workflows. Served as a primary frontend resource and mentored incoming engineers as the team grew from under 10 to over 20." Worked across: Angular · AngularJS · NgRx · Nx · TypeScript · Cypress · ASP.NET Core · Capacitor.
- **Role 2 — 2006–2022 · PEMCO · Full-Stack Developer & IT Manager.** Summary: "Sole developer and IT lead for a 35-person business, owning every system end to end." Body: "Built a customer-facing e-commerce platform from scratch, then rebuilt it as an Angular SPA with Firebase, NgRx, PWA and SSR. Wrapped the on-premise POS system's API with an Express.js layer and built a Node.js sync service keeping customer, product, and quote data for a 3,000-item catalog consistent across SQL and NoSQL — containerized with Docker and maintained from requirements through long-term upkeep." Worked across: Angular · Node.js · Express · Firebase · TypeScript · MSSQL · Docker · PWA & SSR.

### 7.6 About (`#about`, Ink + subtle grid) — eyebrow "05 — About me"

- **Left:** portrait (square, 1px brass border, ~3px radius, responsive and lazy-loaded); mono fact list — Location: Panama (Remote, UTC-5) · Citizenship: United States · Languages: English & Spanish · Education: B.S. Information Studies, Florida State University.
- **Right headline:** "I'm _Daniel McGrath_ — the engineer you hire and the one who does the work." (italic copper on the name)
- **Body:** "Fifteen-plus years across growing teams and solo ownership taught me the same lesson both ways: the cost of software shows up later, in the seams. So I work deliberately from the first line — and I'd rather tell you the harder true thing than the easier comfortable one." / "When you hire me, you get one senior engineer accountable end to end — no account managers, no handoffs to someone more junior. I operate remotely on US-friendly hours and communicate like the people on the other end have a deadline, because usually they do." / "I work as an independent contractor on long-term, full-time engagements, and I can contract through a US LLC or a Panamanian company — whichever fits your procurement process."

### 7.7 Working with me (no anchor, Ink, top brass hairline)

A compact `<dl>` fact strip between About and Contact (auto-fit grid, mono): **Contracting entities:** "CyberTec LLC (US) — C2C, W-9 · Cyber Technologies Development & Consulting, S.A. (Panama)" · **Hours:** "UTC-5 — full overlap with US Eastern and Central business hours" · **Engagements:** "Long-term, full-time remote contracts".

### 7.8 Contact / footer (`#contact`, **Blueprint**) — eyebrow "06 — Get in touch"

- **Headline:** "Have a project worth _building well_?"
- **Sub:** "Tell me what you're building and where it's stuck. I'll be straight about whether I'm the right fit and how I'd approach it."
- **Buttons:** primary copper **`contact@cybertec.io`** (`mailto:`); outline **GitHub ↗** (`https://github.com/cybertecpty`); outline **LinkedIn ↗** (`https://linkedin.com/in/djmcgrath101`). Outbound links open in a new tab with a screen-reader "(opens in a new tab)" note.
- **Footer lockup:** CT mark (Paper-filled) + "CyberTec" (Fraunces) + tagline "Code, crafted with care" (mono, uppercase, letterspaced); right: "© {year} CyberTec LLC" (year = `new Date().getFullYear()`).

## 8. Design system & tokens

**Authoritative pixel spec: `design-handoff-README.md`.** Key tokens (CSS custom properties in `src/styles/global.css`, mirrored into Tailwind v4 `@theme` blocks):

```css
--ink: #14110d;
--paper: #e8e3d8;
--copper: #c66b3d;
--brass: #b8965a;
--blueprint: #273d4b; /* revised 2026-06-25 from #2d4a5c */
--steel: #857c6b; /* lightened for AA on Ink (#61) */
--copper-on-paper: #9a4a28; /* deeper copper for copper text on Paper (AA) */
--body-on-ink: #c9c3b6;
--font-display: 'Fraunces', serif;
--font-body: 'IBM Plex Sans', sans-serif;
--font-mono: 'IBM Plex Mono', monospace;
--radius-sm: 2px;
--radius-md: 3px;
--maxw: 1180px;
--pad-x: 28px;
--grid-texture: 46px;
```

- **Layout:** max content 1180px, 28px gutters, ~104px section rhythm. Blueprint grid texture (46px, brass at 0.04–0.05 alpha) on Hero + About. Brass hairlines (`rgba(184,150,90,0.14–0.22)`) for borders/dividers. `::selection` copper-on-ink.
- **Color usage:** roughly Ink 60% / Paper 25% / Copper 10% / Brass+Blueprint+Steel 5%. **Body text is `--body-on-ink` on Ink and Ink on Paper — never copper at body size.** Copper for headings-accents, links, CTAs, the mark; on the Paper section, any copper _text_ must use the deeper copper (about `#9A4A28`) for AA (copper graphics/large only need 3:1). Verify every pairing at WCAG 2.2 AA (Paper + Blueprint surfaces included).
- **Type:** Fraunces (headings + wordmark) with **exactly one italic-copper accent per headline**; IBM Plex Sans (body/UI); IBM Plex Mono (eyebrows, labels, chips, credibility strip, tagline) — uppercase, ~0.12–0.22em tracking. Fluid headline sizing via `clamp()`. Self-host woff2 (Latin subset, `font-display:swap`, preload hero Fraunces) — the design links Google Fonts; self-hosting is preferred for perf/privacy but the Google Fonts `<link>` is acceptable.
- **Theming:** single **dark** scheme driven by the CSS custom properties above (`color-scheme: dark`, no light mode). Tight shape (2–3px radius), flat surfaces, brass hairlines over shadows. Smooth in-page scrolling and hover translate are gated behind `prefers-reduced-motion: no-preference`.
- **Aesthetic guardrail:** warm-dark, architectural, premium, generous whitespace. **Avoid** generic dark-SaaS (purple/cyan glows, neon, geometric-sans everything, glassmorphism, stock 3D). Mark stays quiet (nav + footer); no 匠 story on the page.

## 9. Components, state & interactions

- **Build:** Astro 7 static site with Tailwind CSS v4 (`@tailwindcss/vite`); `.astro` components, no client framework, no global store.
- **Components:** `Header`, `Hero`, `Services`, `Stack`, `Principles`, `Experience`, `About`, `WorkingWithMe`, `Contact`, `Footer`, composed in `src/pages/index.astro` inside `BaseLayout` (head, SEO meta, JSON-LD). Copy lives in each component's frontmatter arrays.
- **Minimal dynamic behavior:** mobile nav disclosure (`<details>`), smooth in-page anchor scrolling, footer year (`getFullYear()`). Hover states: button `translateY(-2px)`; hero CTA copper glow; outline buttons → copper border. No modals, no data fetching. **Not implemented:** scroll-spy highlighting of the active nav link (see §14).

## 10. Responsive behavior

Mobile-first. All multi-column grids use `auto-fit` + `minmax(...)` so they collapse to one column on phones **without media queries — preserve this**. Headlines use `clamp()`. Header nav inline on desktop; a simple stacked/condensed menu on narrow widths (a reasonable production enhancement over the prototype's inline nav). Tap targets ≥44px.

## 11. SEO, performance, analytics

- **SEO:** keyword-aware `<title>` (e.g. "Daniel McGrath — Senior Full-Stack Engineer (Angular) · CyberTec") + meta description; OG/Twitter card with the copper-on-ink lockup; **JSON-LD `Person`** (name, jobTitle, `knowsAbout` = the stack, `alumniOf` FSU, `address` country PA, `sameAs` GitHub + LinkedIn); `sitemap.xml`, `robots.txt`, canonical. No `hreflang` (single locale). Favicon from `assets/cybertec-favicon.svg`.
- **Rendering:** Astro static build (SSG) to plain HTML so the page is fully crawlable and unfurls cleanly — important for ranking on "CyberTec" + "Daniel McGrath".
- **Performance:** LCP <2.0s, CLS <0.05, INP <200ms; Lighthouse ≥95. Self-hosted `@fontsource` fonts with the hero Fraunces files (normal + italic) preloaded in `BaseLayout.astro` to prevent a swap-induced layout shift; `daniel.jpg` served through Astro `<Image>` (responsive widths, lazy-loaded); hashed asset names. `staticwebapp.config.json` currently sets security headers only (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) — cache and compression headers are open (§14).
- **Analytics:** none shipped. The v2.1 plan was **Cloudflare Web Analytics** (free, cookieless, no consent banner); alternatives are Azure Application Insights or none. Open decision (§14).

## 12. Tech stack & deploy

- **Astro 7** static site + **Tailwind CSS v4** (`@tailwindcss/vite`), in the Nx workspace as a plain project (ADR 0012). Self-hosted fonts via `@fontsource`. No client framework, no NgRx, no Angular Material.
- **Host: Azure Static Web Apps** (Free tier), deployed with `nx run cybertec-io:deploy` (`swa deploy`); apex domain cybertec.io; `staticwebapp.config.json` for headers. **Status:** live (re-deployed after being taken offline in the previous workspace).
- **Targets:** `build`, `serve`, `preview`, `test` (vitest over the built output), `typecheck` (`astro check`), plus the `cybertec-io-e2e` Playwright project.
- **No form backend, no Turnstile, no Azure Function.**

## 13. Assets

- **Logo SVGs (use as-is):** `assets/cybertec-mark-copper.svg`, `cybertec-mark-white.svg`, `cybertec-mark-ink.svg`, `cybertec-primary-light.svg` (wordmark lockup), `cybertec-favicon.svg`. Mark quiet in nav (copper/Paper on Ink) + footer.
- **Portrait:** `assets/daniel.jpg` (square) → optimize to responsive AVIF/WebP + JPG fallback.
- **Fonts:** Fraunces, IBM Plex Sans, IBM Plex Mono (SIL OFL). Self-host woff2; keep `OFL.txt`.
- **Reference:** `design-handoff-README.md` (pixel spec) + `CyberTec Homepage.reference.html` (open to view). **Parked:** `cybertec-site-copy-es.md` (Phase-2 Spanish), boutique HTML (Phase 2).

## 14. Open items

- **Resolved by the build:** copy (§7, as shipped), Experience outcomes (O2), rates (O1 — availability pill only, no rate shown), stack named, dark-only, English-only, mailto contact, contact@cybertec.io.
- **A1 — Analytics:** none shipped. Decide between Cloudflare Web Analytics (cookieless, no banner), Azure Application Insights, or none.
- **A2 — Scroll-spy:** active-nav-link highlighting from v2.1 is not implemented. Implement or drop.
- **A3 — Caching and compression:** `staticwebapp.config.json` has security headers only; add cache and compression headers if the site is redeployed.
- **A4 — CI gates:** Lighthouse and axe gates (§2, §11) are not confirmed in CI; confirm or add them. A manual Lighthouse run against the live site is recorded in §15.
- **N4 — pre-launch (launch gate):** trademark search for "CyberTec" (name remains contested); native-Japanese-speaker review of the 匠 mark is lower urgency now its story is off the page, but still advisable since the mark reads as 匠. _(Owner: Daniel.)_
- **O3 — Phase-2 trigger (non-blocking):** reputation milestone that flips the site back toward the boutique framing (preserved separately).
- **O4 — future proof (Phase 2):** sanitized metrics/references/repos for a real "Selected Work" later.

## 15. Acceptance criteria (definition of done)

Checked items are met by the shipped source. Unchecked items are open (see §14) or unverified. Lighthouse (CLI 13.5.0, headless) was run manually against https://cybertec.io on 2026-10-07; axe has not been run.

- [x] Single-page, **English-only, dark-primary** site live at cybertec.io on **Azure Static Web Apps** (apex domain, managed TLS).
- [x] Built with **Astro 7 + Tailwind CSS v4**, **no NgRx**, statically generated to HTML.
- [x] All sections (§6) present, with `auto-fit` grids that collapse to one column on mobile without hard-capped columns.
- [x] Shipped copy (§7) matches the site; Fraunces headings each carry exactly one italic-copper accent; mono eyebrows/labels/tagline; Ink/Paper/Copper/Brass/Blueprint/Steel; mark quiet in nav + footer; **no 匠 story on the page**.
- [ ] Body text never copper; copper text on Paper uses the deeper copper (done); every pairing passes WCAG 2.2 AA (not yet verified).
- [x] **Contact = mailto + links:** `contact@cybertec.io` (mailto), GitHub, LinkedIn. "Hire me" and "Get in touch" CTAs land on `#contact`. **No form anywhere.**
- [x] Portrait in About, responsive and lazy-loaded with alt text. Favicon set from the SVG.
- [ ] Analytics (A1) — not shipped.
- [x] Responsive mobile-first; nav condenses to a disclosure menu; mobile menu tap target ≥44px; `prefers-reduced-motion` honored; footer year dynamic. Scroll-spy not implemented (A2).
- [x] SEO: static HTML, JSON-LD `Person`, sitemap, robots, canonical, Open Graph and Twitter card.
- [x] Lighthouse ≥95 across Performance, Accessibility, Best Practices, SEO; LCP <2.0s, CLS <0.05. Live run before the font preload: mobile 100/100/100/100 (LCP 0.9s, CLS 0.003); desktop Performance 94 (CLS 0.154, from the Fraunces font swap shifting the hero), others 100. With the preload, a local build measures desktop Performance 100 (CLS 0.001) and mobile 97 (CLS 0). Re-run against the live site after the preload is deployed.
- [ ] CI runs Lighthouse/axe gates (A4, not confirmed).

---

_End of PRD v2.2 — Phase-1 contractor site, reconciled to the shipped Astro build. Open: A1–A4, N4 (launch gate), O3–O4 (Phase 2)._
