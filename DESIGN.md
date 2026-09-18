# StockLens — Design System (2026-09-18 rebrand)

This replaces the hand-drawn pencil/paper concept locked in `CLAUDE.md` on
2026-09-16. That look (Rough.js sketchy borders, paper-noise backgrounds,
torn-paper edges, pin icons, handwriting fonts) is discontinued — nothing new
should be built in that style, and existing instances are migrated
section-by-section (see **Rollout status** at the bottom).

## 1. Illustration system — Open Peeps, unmodified

We use [Open Peeps](https://www.openpeeps.com/) by Pablo Stanley as-is. **No
custom mascot is drawn.**

- **License:** CC0 1.0 — free for commercial and personal use, no attribution
  required. (Confirmed directly on openpeeps.com before use.)
- **Format used:** individual pose SVGs downloaded straight from
  openpeeps.com's own CDN (the site offers ready-made SVG/PNG downloads per
  pose directly on the page — no Figma/Sketch/XD needed). These are the
  official artwork, not a third-party regeneration.
  - We did *not* use the DiceBear `open-peeps` avatar API: it's also a
    legitimate CC0 remix of the same source, but it only exposes cropped
    head-and-shoulders busts (no arm/hand poses), so it can't produce a
    greeting/waving figure.
- **Where they live:** `assets/peeps/` — 49 poses downloaded (see
  `assets/peeps/SOURCE.md` for provenance details), so later sections can
  reuse the set without re-fetching one at a time.
- **Style:** already pure black line art in the source files —
  `fill="#000000"` / `fill="#FFFFFF"` / `fill="none"` only, no color. No
  recoloring needed; if a future pose ever came in color, unify its strokes
  to black rather than introducing a new tint.
- **Usage:** decorative/editorial illustration (hero figures, empty states,
  onboarding-style moments). Not a repeatable icon system — for small UI
  icons (search, chevrons, etc.) keep using plain inline SVG, not a Peep.

## 2. Typography

| Role | Family | Weight |
|---|---|---|
| Headline (`h1`, and eventually other headings) | Pretendard | **900 (Black)** |
| Body (paragraphs, nav, form, table, everything else) | Pretendard | 400 (`h3` stays 700) |

- Pretendard is already loaded (`pretendard.css` via jsDelivr in
  `index.html`) — no new font CDN needed, Black is just another weight of
  the same family.
- **Removed entirely:** the BMYEONSUNG (`Yeonseong`) `@font-face` block and
  the Caveat Google Fonts `<link>`. Nothing in the codebase should reference
  either name again.
- `--font-display` now resolves to `"Pretendard", sans-serif` (was
  `"Yeonseong", "Caveat", sans-serif`). It's still the shared token for
  display-ish elements (headings, logo, buttons) — only its value changed,
  not its role — but only `.hero h1` is bumped to weight 900 so far; other
  headings keep their existing 700 until they're migrated in a later step
  (see **Rollout status**).

## 3. Color

Three color groups, kept strictly separate — never substitute one for another:

1. **Signature/brand color — `--color-accent: #D97757`** (terracotta/clay).
   Buttons, links, focus rings, badges, any single point of emphasis. This
   is the *only* accent color in the system — no second "secondary" hue.
   - The user-supplied hex is an approximation of the Claude Code icon
     color. No actual icon asset was available in this session to sample a
     more precise value from, so `#D97757` is used exactly as given rather
     than guessed/adjusted.
   - `--color-accent-contrast` (text/icon color *on top of* the accent) is
     `--color-text` (black), not white: white-on-`#D97757` measures ~3.1:1
     contrast, which fails WCAG AA for normal-size text (needs 4.5:1);
     black-on-`#D97757` measures ~6.7:1. This is a correctness fix, not a
     stylistic choice — every `.btn-primary` across the site benefits.
   - `--color-accent-soft` (light tint, for badge backgrounds) is a pale
     terracotta (`#f7e4dc`) instead of the old pale blue.
2. **Financial up/down — `--color-up` / `--color-down`**. Unchanged
   (`#1a7f37` / `#d1242f`). This is a finance-data convention, not a brand
   choice, and is never reused for anything else (no "success/error" toast
   reusing these, no decorative use).
3. **Base text/background — `--color-text` (black) / `--color-bg`,
   `--color-surface` (white)**. Unchanged. A very pale cream is allowed by
   this system if a specific surface wants warmth, but nothing currently
   uses one (the hero was tried both ways; plain white read cleaner once
   the paper texture was gone, so that's what shipped).

## 4. Removed / to be removed

Discontinued outright, not to be used in any new work:

- Rough.js hand-drawn borders/dividers (`rough-box`, `rough-divider`,
  `drawRoughBoxes()` etc. in `script.js`)
- Paper-noise texture backgrounds (`--noise-texture`)
- Torn-paper `clip-path` edges
- Pin/pushpin icons
- Handwriting fonts (BMYEONSUNG/Yeonseong, Caveat)

Shadows are minimized site-wide going forward — prefer a hairline border or
whitespace to separate content over a drop shadow. Where depth is still
needed, keep it faint (the removed hand-drawn borders are not being replaced
with a heavier shadow system).

## Rollout status

- **Cover screen:** migrated (2026-09-18). Peeps illustration, Pretendard
  Black headline, plain white background, terracotta CTA button with a
  fade+scale transition (replacing the paper-roll-screen pull-tab).
- **Everything else** (realtime grid, big-events cards, nav/header/footer,
  the global `--noise-texture` body background, the rest of the Rough.js
  usage): **not yet migrated** — still on the old hand-drawn system,
  pending a follow-up pass. `--font-display`'s value did change globally
  (see §2), so their text already renders in Pretendard rather than the
  now-deleted handwriting fonts, but their weight/borders/backgrounds are
  untouched until that pass.
