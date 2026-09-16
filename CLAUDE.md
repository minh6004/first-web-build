# first-web-build

Static HTML/CSS/JS skeleton for a stock-analysis site (economic indicators, international-org
announcements, news synthesized into a buy/sell fit judgment). Files: `index.html`, `style.css`,
`script.js`. No build step, no framework.

## Git workflow

- This directory is a git repo tracking `origin/main` at `https://github.com/minh6004/first-web-build.git`.
- **Whenever you finish a code change here (edit index.html/style.css/script.js or add files), commit and push to `origin/main` right away — don't wait to be asked.** Standing user instruction (2026-09-16).
- Still use judgment on commit boundaries: one logical change per commit, clear message, no `--force`, no `--no-verify`. Ask first only for something destructive (e.g. history rewrite) — routine commit+push for normal edits needs no confirmation.

## Design system (locked as the site's main concept — 2026-09-16)

The user confirmed the current look is the permanent direction, not a placeholder style. **Any new
section, component, or page must match this, not introduce a new look.** Read `style.css`'s `:root`
tokens before adding anything, and reuse them — don't invent new colors/fonts/spacing values.

- **Palette**: white background (`--color-bg`/`--color-surface: #ffffff`), near-black text
  (`--color-text: #000000`), single accent blue (`--color-accent: #0b99ff`) used consistently for
  every interactive/primary-emphasis element. No dark mode (removed on purpose — always light).
- **Typography, split by role**:
  - Display (h1, h2, `.logo`, `.btn`): `--font-display` = Yeonseong (BMYEONSUNG, Korean) + Caveat
    Bold (Latin/numbers), `font-weight: 700`. The BMYEONSUNG `@font-face` needs its `unicode-range`
    kept (it has its own Latin glyphs that would otherwise shadow Caveat).
  - Body (everything else — p, h3, nav, table, form, footer): `--font-body` = Pretendard, 400
    (h3 uses 700 for hierarchy). Never put small/dense text (numbers, long copy) in the display font.
- **Hand-drawn / sketch motif (Rough.js)**: loaded via `<script src="https://cdn.jsdelivr.net/npm/roughjs@4/bundled/rough.js">`
  before `script.js`. This is the site's signature visual device — any new bordered box or
  horizontal separator should use it too, not a plain CSS `border`.
  - Fixed roughness value: **`roughness: 2.2`, `bowing: 2`** — reuse these constants
    (`ROUGH_ROUGHNESS`/`ROUGH_BOWING` in `script.js`), don't pick new numbers per element.
  - Stroke color: `--color-divider-rough` (`#a8a8a8`), read via `getComputedStyle`, not hardcoded.
  - Pattern to copy: keep the plain CSS `border`/`border-bottom` as a no-JS fallback, and hide it
    only under the `.rough-ready` class (added once Rough.js successfully draws) via
    `border-color: transparent` — never `border: none`, so layout dimensions never shift. See
    `.rough-box`, `.rough-divider`, `drawRoughBoxes()`/`drawRoughDividers()`/`drawRoughInnerDividers()`
    in `script.js` for the established implementation to extend rather than reinvent.
  - Everything Rough.js draws redraws on window `resize` (debounced) — new elements must hook into
    that same redraw cycle (`redrawAllRough()`), not a one-shot draw.
- **Paper texture**: subtle SVG-noise `background-image` on `body` (feTurbulence, alpha `0.09`).
  Applies once at the page level — don't re-add it per-section.
- **Hero doodles**: 4 hand-drawn finance-themed SVG icons (chart/candles/megaphone/clock), desktop-only
  (hidden below 1024px), one has a subtle CSS wiggle. This is hero-specific decoration, not a pattern
  to repeat elsewhere — don't add more standalone decorative SVGs outside the hero without asking.
- Full rationale/history for all of the above is in claude-mem project memory
  (`design-tokens-gm-meme`, `first-web-build-structure`) — check there before making a judgment call
  on anything not covered here.
