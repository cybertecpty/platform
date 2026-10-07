# Handoff: CyberTec Marketing Homepage

> ⚠️ **Vendored design-phase artifact — read alongside [ADR 0012](../../../docs/adr/0012-astro-content-sites.md).**
> Kept in-repo for its section specs and body copy. Two corrections to the
> historical framing below:
>
> 1. The codebase **already exists** — `apps/cybertec-io` is an **Astro + Tailwind
>    CSS v4** static site (ADR 0012); recreate the design there. The "no existing
>    codebase / choose a setup" wording predates the repo (Astro was the chosen
>    setup, so the recommendation was followed).
> 2. The external bundle this doc references — the `.reference.html` / `.dc.html`
>    prototypes, `CyberTec-Design-Guide-v2.md`, and the `assets/` portrait + logo
>    SVGs — is **not vendored here**; brand-asset integration is tracked separately
>    (#50).
>
> This doc is the **canonical source for branding** (colors, type, tokens, spacing,
> copy) — the shipped app is a _consumer_ that mirrors it, so a brand/token change
> lands here first and the app follows (e.g. `--blueprint` was revised to `#273D4B`).
> The app is authoritative only for non-branding **implementation/behavior** detail
> where it refines the doc — e.g. `scroll-behavior: smooth` is gated behind
> `prefers-reduced-motion: no-preference`, not applied unconditionally.

## Overview

A single-page, dark-primary marketing homepage for **CyberTec** — the professional identity of **Daniel McGrath**, a senior full-stack engineer (Angular specialist) available for contract/freelance work. The page's job is to win contract engagements: establish senior credibility, surface a scannable skill set, convey how he works, show real experience, and drive contact.

## About the Design Files

The files in this bundle are **design references created in HTML** — a faithful, high-fidelity prototype of the intended look and behavior. They are **not** production code to ship directly (the `.dc.html` file uses an internal authoring runtime via `support.js` and inline-style attributes).

Your task is to **recreate this design in a real codebase** using clean, semantic, production HTML/CSS (and minimal JS). There is no existing codebase to match, so **choose an appropriate setup for a static marketing page** — recommended: **Astro** or **plain semantic HTML + a single CSS file**. This is a static site (no app state, no data fetching, SEO matters), so avoid a heavy SPA framework.

`CyberTec Homepage.reference.html` is a flattened, browser-openable copy you can view directly for pixel reference.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, and copy are all intentional. Recreate the UI pixel-faithfully. Note that the prototype uses **inline styles**; in production, convert these to a stylesheet with CSS custom properties for the tokens (see Design Tokens) and real CSS classes.

## Global Layout

- **Max content width:** `1180px`, centered (`margin: 0 auto`), horizontal padding `28px`.
- **Section vertical rhythm:** ~`104px` top/bottom padding on most sections.
- **Section order:** Sticky header → Hero → How I help (services) → Stack & tooling → How I work (principles) → Experience → About → Contact/footer.
- **Background system:** Ink `#14110D` is primary. ONE Paper `#E8E3D8` section (Stack) for contrast. Contact section on Blueprint `#273D4B`. Hero and About carry a _very subtle_ blueprint grid texture (see below).
- **Blueprint grid texture** (Hero, About): two layered linear-gradients forming a 46px grid:
  ```css
  background-image:
    linear-gradient(rgba(184, 150, 90, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(184, 150, 90, 0.05) 1px, transparent 1px);
  background-size: 46px 46px;
  ```
  (Use `0.04` alpha on the About section.)
- **Hairlines:** brass at low alpha, `rgba(184,150,90,0.14–0.22)`, for section borders and dividers.

## Screens / Views

This is a single scrolling page. Each "view" below is a section.

### Header (sticky)

- **Layout:** sticky top, `z-index:50`, `background: rgba(20,17,13,0.82)` + `backdrop-filter: blur(10px)`, bottom border `1px solid rgba(184,150,90,0.18)`. Inner: flex row, space-between, `padding:18px 28px`, max-width 1180.
- **Left:** CT mark SVG (30×30) + wordmark "CyberTec" (Fraunces 500, 23px, letter-spacing -0.01em, Paper).
- **Right nav:** mono links (IBM Plex Mono, 12px, letter-spacing 0.12em, uppercase, color `#B8B3A6`), gap 32px: **How I help · Stack · How I work · Experience · About**, anchored to `#services #skills #principles #experience #about`. Then a **Hire me** button: copper text, `1px solid rgba(198,107,61,0.45)` border, padding `9px 16px`, radius 2px; hover → background copper, text Ink.
- **Note:** nav link labels intentionally differ from section headings but map to the right anchors.

### Hero (`#top`)

- Blueprint grid bg, bottom border brass hairline. Padding `108px 28px 96px`.
- **Availability pill:** inline-flex, brass border `1px solid rgba(184,150,90,0.3)`, radius 999px, padding `7px 16px`, mono 12px uppercase, brass text; leading 7px copper dot. Text: "Available for contract & freelance work".
- **Eyebrow:** mono 12.5px, letter-spacing 0.22em, uppercase, copper. "Senior Full-Stack Engineer · Angular Specialist".
- **Headline:** Fraunces 400, `clamp(40px,6.6vw,82px)`, line-height 1.04, letter-spacing -0.02em, max-width 16ch. "I build production software, _made to last_." — the words "made to last" in _italic copper, weight 500_.
- **Subhead:** IBM Plex Sans, `clamp(18px,2.2vw,22px)`, line-height 1.5, color `#C9C3B6`, max-width 48ch. "I'm Daniel McGrath — a senior full-stack engineer with 15+ years shipping and modernizing Angular applications, from enterprise platforms serving hundreds of thousands of users to systems I owned end to end as the sole developer."
- **CTAs:** primary copper button "Hire me →" (Ink text, mono 13px uppercase, padding `15px 26px`, radius 2px, weight 500; hover translateY(-2px) + copper glow shadow). Secondary text link "See my work" (brass, mono, brass underline).
- **Credibility strip:** below, brass-slash-separated mono items (11px, letter-spacing 0.16em, uppercase, Steel `#857C6B`): "15+ Years" / "Remote · Panama (US Citizen)" / "English & Spanish".

### How I help — Services (`#services`, Ink)

- Eyebrow "01 — How I can help" (mono, Steel).
- **3-column grid** via 1px brass gaps over a brass background (creates hairline dividers): `display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1px; background:rgba(184,150,90,0.18); border:1px solid rgba(184,150,90,0.18)`. Each cell `background:#14110D; padding:40px 34px`.
- Each cell: copper mono kicker (Build / Modernize / Strengthen), Fraunces 500 24px title, Plex Sans 15px body `#C9C3B6`. Copy in the reference file.

### Stack & tooling (`#skills`, Paper `#E8E3D8`, dark text `#14110D`)

- Eyebrow "02 — Stack & tooling". Headline Fraunces 400 `clamp(30px,4.4vw,48px)`: "The tools I reach for, _day to day_." (italic copper accent).
- **Grid of skill groups:** `repeat(auto-fit,minmax(230px,1fr))`, gap `44px 40px`. Each group: brass mono label with bottom hairline `rgba(20,17,13,0.2)`, then wrap of chips.
- **Chip:** Plex Sans 14px, Ink text, `background:rgba(20,17,13,0.06)`, border `1px solid rgba(20,17,13,0.14)`, radius 2px, padding `6px 12px`; flex-wrap gap 8px.
- **Groups & items (current, authoritative):**
  - Frontend: Angular 14+, Angular Material, NgRx, RxJS, Tailwind CSS, Bootstrap
  - Backend: Node.js, Express.js, NestJS, Firebase, Azure
  - Languages: TypeScript, JavaScript, HTML5, CSS3, SASS
  - Databases: Microsoft SQL Server, MySQL
  - Tooling: Nx, Playwright, Jest, Jasmine, Git / GitHub, CI/CD, PWA, REST APIs, Agile / Scrum

### How I work — Principles (`#principles`, Ink)

- Eyebrow "03 — How I work". Headline: "What it's like to _work with me_." (italic copper).
- **Grid:** `repeat(auto-fit,minmax(300px,1fr))`, gap `48px 44px`. With 7 items this lands 3+3+1 on desktop, 2-up on tablet, 1-up on mobile (this responsive behavior is intentional — do NOT hard-cap columns, it breaks mobile).
- Each card: roman-numeral mono label (brass) with bottom hairline `rgba(184,150,90,0.22)`, Fraunces 500 23px title, Plex Sans 15px body `#C9C3B6`.
- **The seven (order matters):**
  1. **Crafted with care** — "Readable, well-tested, consistent code is the baseline, not a luxury. Quality isn't a phase at the end — it's the difference between software that lasts and software you rewrite."
  2. **Tame the complexity** — "Complexity is the real enemy — not bug count. I build deep modules behind simple interfaces, keeping the system easy to reason about and safe to change as it grows."
  3. **Keep the core independent** — "Business rules shouldn't depend on the framework, the database, or this year's library. I keep the details at the edges so the parts that matter survive the parts that change."
  4. **Speak the language of the problem** — "Good software starts with understanding the business, not the tech. I learn how your team actually talks about the domain and model it in that language — so the code and the conversation stay in sync."
  5. **No surprises** — "Clear communication, honest estimates, and steady updates. You'll always know where things stand — and you'll hear the hard truth before it becomes an expensive one."
  6. **Leave it better than I found it** — "I'm usually working in code someone else wrote, under real constraints. I improve what I touch — a little cleaner, a little safer each pass — without demanding a rewrite to do it."
  7. **Pragmatism over dogma** — "Principles serve the project, not the other way around. I know when good-enough is the right call and ship real value on real deadlines — the craft is in the judgment, not in gold-plating."

### Experience (`#experience`, Ink, top brass hairline)

- Eyebrow "04 — Experience". Headline: "Two decades of _shipped, maintained_ software."
- **Stats row** (hairline-gap grid like Services, `minmax(200px,1fr)`): Fraunces 500 44px copper number + mono caption. `15+` Years building production software · `100k+` Users served by platforms I shipped · `End-to-end` Ownership — architecture through upkeep. (Use `&#8209;` non-breaking hyphen in "End-to-end".)
- **Two role rows:** each a `minmax(0,0.7fr) minmax(0,2fr)` grid, gap 40px, top hairline, padding `36px 0`.
  - Left: brass mono date range + Steel mono employer/role.
  - Right: Fraunces 500 23px role summary, Plex Sans `#C9C3B6` outcome paragraph (max-width 62ch), then a "Worked across" mono tech line (brass label + Steel list).
  - **Role 1 — 2023–2026, TeachTown · Software Engineer:** "Frontend engineer on Angular education platforms serving hundreds of thousands of students across thousands of schools." Body + tags: Angular · NgRx · Nx · TypeScript · Cypress · ASP.NET Core · Capacitor.
  - **Role 2 — 2006–2022, PEMCO, S.A. · IT Manager & Full-Stack Dev:** "Sole developer and IT lead for a 35-person business, owning every system end to end." Body + tags: Angular · Node.js · Express · Firebase · TypeScript · MSSQL · Algolia · PWA & SSR.
  - (Exact body copy in the reference HTML. Experience tags deliberately list the tech actually used per role, even where it differs from the current day-to-day Stack section.)

### About (`#about`, Ink + subtle blueprint grid)

- Two-column: `minmax(0,1fr) minmax(0,1.5fr)`, gap 64px, align-items start.
- **Left:** portrait `assets/daniel.jpg` (max-width 320px, `aspect-ratio:1`, `object-fit:cover`, 1px brass border, radius 3px), then a mono fact list (brass label + value): Location — Panama City (Remote); Citizenship — United States; Languages — English & Spanish; Education — B.S. Information Science, FSU.
- **Right:** eyebrow "05 — About me"; headline Fraunces 400 `clamp(26px,3.6vw,38px)`: "I'm _Daniel McGrath_ — the engineer you hire and the one who does the work." (italic copper on the name); two body paragraphs (in reference) emphasizing direct accountability, no handoffs, remote US-friendly hours, clear communication.

### Contact / Footer (`#contact`, Blueprint `#273D4B`)

- Eyebrow "06 — Get in touch" (mono, low-alpha Paper). Headline Fraunces 400 `clamp(32px,5.4vw,64px)`: "Have a project worth _building well_?" (italic copper). Sub: "Tell me what you're building and where it's stuck. I'll be straight about whether I'm the right fit and how I'd approach it."
- **Buttons:** primary copper `contact@cybertec.io` (mailto); outline `GitHub ↗` (https://github.com/cybertecpty); outline `LinkedIn ↗` (https://linkedin.com/in/djmcgrath101). Outline = `1px solid rgba(232,227,216,0.3)`, hover border copper.
- **Footer lockup:** top hairline `rgba(232,227,216,0.2)`; CT mark (Paper-filled, 34×34) + "CyberTec" (Fraunces 500 21px) + tagline "Code, crafted with care" (mono 10.5px, letter-spacing 0.18em, uppercase, low-alpha Paper). Right: "© <year> Daniel McGrath · CyberTec".

## Interactions & Behavior

- **Smooth scroll:** `html { scroll-behavior: smooth; }`; nav links are in-page anchors.
- **Sticky header** with blur backdrop.
- **Hover states:** primary buttons `translateY(-2px)` (+ copper glow on the hero CTA: `box-shadow:0 10px 30px -10px rgba(198,107,61,0.6)`); Hire-me nav button fills copper; outline buttons shift border to copper; transitions ~0.2s.
- **Selection color:** `::selection { background:#C66B3D; color:#14110D; }`.
- No modals, no JS state, no data fetching. The only dynamic value is the footer year (`new Date().getFullYear()`).

## Responsive Behavior

- Mobile-first. All multi-column grids use `auto-fit` + `minmax(...)` so they collapse to 1 column on phones without media queries — **preserve this**; do not impose fixed column counts.
- Headlines use `clamp()` for fluid scaling.
- Header nav: on narrow widths consider a simple stacked/condensed menu (the prototype keeps it inline; a mobile menu is a reasonable production enhancement).

## Design Tokens

```css
:root {
  /* color */
  --ink: #14110d; /* primary bg (warm near-black) */
  --paper: #e8e3d8; /* light sections; body text on dark */
  --copper: #c66b3d; /* accent, links, CTAs, mark */
  --brass: #b8965a; /* hairlines, fine detail, secondary emphasis */
  --blueprint: #273d4b; /* contact surface — revised 2026-06-25 from #2d4a5c */
  --steel: #857c6b; /* captions, mono labels, muted text — lightened for AA on Ink (#61) */
  --body-on-ink: #c9c3b6; /* body text color on Ink (Paper-tinted) */

  /* type */
  --font-display: 'Fraunces', serif; /* headings, wordmark */
  --font-body: 'IBM Plex Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace; /* eyebrows, labels, tagline */

  /* radius */
  --radius-sm: 2px; /* buttons, chips */
  --radius-md: 3px; /* portrait, cards */

  /* layout */
  --maxw: 1180px;
  --pad-x: 28px;
  --grid-texture: 46px;
}
```

- **Usage ratio:** ~Ink 60% / Paper 25% / Copper 10% / Brass+Blueprint+Steel 5%. Copper is an accent only.
- **Accessibility:** body text is Paper/`--body-on-ink` on Ink — **never copper at body size** (copper fails AA on Ink at small sizes). Copper is fine for large headings, links, and accents.
- **Type usage:** Fraunces for all headings + wordmark, with exactly one _italic copper_ accent word per headline. IBM Plex Mono for eyebrows/labels/captions/tagline — uppercase, wide letterspacing. IBM Plex Sans for body/UI.
- **Google Fonts:** Fraunces (ital + opsz, 400/500/600), IBM Plex Sans (400/500), IBM Plex Mono (400/500). Link in the reference `<head>`.

## Assets

- `assets/daniel.jpg` — Daniel's portrait (square, already cropped). Included in this bundle.
- **Logo / mark SVGs** (included in `assets/`): `cybertec-mark-copper.svg`, `cybertec-mark-white.svg`, `cybertec-mark-ink.svg`, `cybertec-primary-light.svg` (full wordmark lockup), `cybertec-favicon.svg`. **Use these as-is — do not redraw.** (The prototype inlines a simplified path approximation of the mark for convenience; prefer the supplied SVG files in production.)
- Brand identity reference: `CyberTec-Design-Guide-v2.md` (included).

## Files

- `CyberTec Homepage.reference.html` — flattened, browser-openable hi-fi reference (open this to see the design).
- `CyberTec Homepage.dc.html` — original source prototype (authoring-runtime format; reference only).
- `CyberTec-Design-Guide-v2.md` — full brand/strategy guide (tokens, voice, positioning, open questions).
- `assets/` — portrait + logo SVGs.

## Notes

- This is the **contractor-phase** version of the site (first-person, skills-forward). A separate boutique/studio version exists in the source project if positioning shifts later — not included here.
- Recommended build target: **Astro** or **semantic HTML + one CSS file**. Static, fast, SEO-friendly. Wire the contact email/GitHub/LinkedIn as real links; consider a favicon from `cybertec-favicon.svg` and basic OpenGraph meta.
