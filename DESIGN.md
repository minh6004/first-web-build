# StockLens — Design System (2026-09-18 rebrand, warmed up 2026-09-19)

This replaces the hand-drawn pencil/paper concept locked in `CLAUDE.md` on
2026-09-16. That look (Rough.js sketchy borders, paper-noise backgrounds,
torn-paper edges, pin icons, handwriting fonts) is discontinued and, as of
2026-09-19, fully removed site-wide (see **Rollout status**).

On 2026-09-19 the palette was also warmed up: the initial rebrand kept black
text on a white background and used the terracotta accent sparingly (buttons/
links only). The mascot illustrations added the same day (cream fur,
terracotta sweater — see `assets/illustrations/mascot/`) made that pairing
read as cold and disconnected by comparison, so black became a warm charcoal
and terracotta's reach was widened considerably. See **§3 Color**.

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

> **⚠️ Open issue (2026-09-19):** a separate custom mascot illustration set
> (Recraft-generated cat, `assets/illustrations/mascot/`) was added the same
> day this section says "no custom mascot is drawn." It hasn't been applied
> to any live site section yet (assets + a standalone preview page only), and
> this contradiction needs to be resolved — replace Open Peeps, run alongside
> it for different contexts, or drop the mascot set — before the mascot goes
> into an actual section. Whoever picks this up next should not just pick a
> side silently; confirm with the user first.

## 2. Typography

| Role | Family | Weight |
|---|---|---|
| Headline (`h1`, `.logo`) | Pretendard | **900 (Black)** |
| Other headings (`h2`, `h3`) | Pretendard | 700 |
| Body (paragraphs, nav, form, table, everything else) | Pretendard | 400 |

- Pretendard is already loaded (`pretendard.css` via jsDelivr in
  `index.html`) — no new font CDN needed, Black is just another weight of
  the same family.
- **Removed entirely:** the BMYEONSUNG (`Yeonseong`) `@font-face` block and
  the Caveat Google Fonts `<link>`. Nothing in the codebase should reference
  either name again.
- `--font-display` resolves to `"Pretendard", sans-serif` (was `"Yeonseong",
  "Caveat", sans-serif`). It's still the shared token for display-ish
  elements (headings, logo, buttons). `.hero h1` and `.logo` are bumped to
  weight 900; `h2`/`h3` are still 700 pending a dedicated type-scale pass —
  bumping every heading to Black site-wide wasn't part of the 2026-09-19
  request and would be a bigger visual swing than "warm up the palette," so
  it was left alone rather than guessed at.

## 3. Color

Three color groups, kept strictly separate — never substitute one for another.
As of 2026-09-19, group 1 (brand) is used far more liberally than the initial
rebrand; group 2 (up/down) is still completely untouched; group 3's text tone
changed but its role didn't.

1. **Signature/brand color — `--color-accent: #D97757`** (terracotta/clay).
   The single accent hue in the system — no second "secondary" color is ever
   introduced alongside it. As of 2026-09-19 its reach was widened well past
   buttons/links, specifically to:
   - Buttons, links, focus rings (unchanged since the initial rebrand).
   - **Card borders** — see `--color-card-border` below; a dedicated darker
     variant, not `--color-accent` itself, because the base accent is too
     light to read clearly as a border against the cream background.
   - **A small vertical accent bar next to every `main` section heading**
     (`main h2::before`), so the brand color shows up in the page's rhythm,
     not only on interactive elements.
   - **Card hover state** — `.card:hover` brightens its border to the full
     `--color-accent` (from the darker `--color-card-border` default).
   - **Small line-art icons that belong to the product** (the big-events
     magnifying-glass icon) — recolored to `--color-accent`. This does *not*
     extend to Open Peeps illustrations (§1: those stay pure black, unmodified)
     or to the up/down colors.
   - **The realtime "LIVE" badge**, via `--color-accent-deep` (see below) —
     a solid-fill, white-text badge instead of the pale-tint style other
     badges (the big-events sector tags) keep using. Not every badge needed
     to become solid-fill; this one specifically wanted "unmistakably
     branded," per the request that introduced it.
   - The user-supplied hex is an approximation of the Claude Code icon
     color. No actual icon asset was available in this session to sample a
     more precise value from, so `#D97757` is used exactly as given rather
     than guessed/adjusted.
   - `--color-accent-contrast` (text/icon color *on top of* the accent) is
     `--color-text` (warm charcoal), not white: white-on-`#D97757` measures
     ~3.1:1 contrast, which fails WCAG AA for normal-size text (needs
     4.5:1); warm-charcoal-on-`#D97757` measures ~4.8:1. This is a
     correctness fix, not a stylistic choice — every `.btn-primary` across
     the site benefits.
   - `--color-accent-soft: #f7e4dc` — pale terracotta tint, for badges that
     want the quiet chip look (e.g. the big-events sector tags).
   - `--color-accent-deep: #b3512d` — a deeper terracotta reserved for
     solid-fill + white-text contexts (currently only the LIVE badge).
     `--color-accent` itself is only ~3.1:1 against white text (fails AA);
     this deeper shade is ~5.2:1 (passes). Reach for this, not a fresh
     white-on-accent combination, anywhere else a solid+white badge is
     wanted later. Its paired text color is `--color-accent-deep-contrast`
     (`#ffffff`) — use the token, not a literal `#fff`, even though the
     value is unlikely to ever change (a QA pass caught the literal once).
   - `--color-card-border: #a8583a` — opaque dark terracotta, used only for
     `.card`'s border. Requested explicitly as "clearly visible against the
     cream background," so it's a solid dark color, not a light tint or a
     translucent one — the initial ask floated 70-80% opacity, but a fully
     opaque dark shade tested clearer against the busy cream+white
     combination than any translucent version did.
2. **Financial up/down — `--color-up` / `--color-down`**. Unchanged
   (`#1a7f37` / `#d1242f`). This is a finance-data convention, not a brand
   choice, and is never reused for anything else (no "success/error" toast
   reusing these, no decorative use, and the brand-color expansion above
   never touches these two).
3. **Base text/background.**
   - `--color-text: #2e2620` (warm charcoal) — was pure black (`#000000`)
     until 2026-09-19. Changed because pure black next to the terracotta
     mascot illustrations and cream background read as cold/clinical; warm
     charcoal keeps near-black contrast (still ~4.8:1+ against the accent,
     ~15:1+ against the cream background) while matching the rest of the
     palette's temperature.
   - `--color-bg: #faf5ec` (warm cream) — was pure white. The initial
     rebrand tried both and shipped white because the hero read "cleaner"
     once the paper texture was gone; once the mascot illustrations (which
     have their own cream backdrop) were added, cream became the better
     match site-wide, so this is now the page background everywhere, not
     hero-specific.
   - `--color-surface: #ffffff` (white) — unchanged, and deliberately still
     white rather than cream: cards need to read as a distinct raised
     surface against the cream page background, and white-on-cream gives
     that separation for free without needing a shadow.
   - `--color-border: #e5ddd0` (warm taupe) — was a cool neutral gray
     (`#e2e2e2`). Used for non-card hairlines that aren't the terracotta
     card border (input fields, `.btn-secondary`'s outline, the ranking
     table's row dividers) — nudged warmer so nothing on the page still
     reads as a cool gray next to everything else.

## 4. Removed

Discontinued outright, and as of 2026-09-19 actually gone from the codebase
(not just "don't use it in new work" — the old markup/CSS/JS was deleted):

- Rough.js entirely — the `<script src=".../rough.js">` tag, `rough-box`/
  `rough-divider`/`rough-box-svg`/`rough-inner-dividers` CSS, and every
  `drawRough*()`/`redrawAllRough()` function in `script.js`. `rough-box` was
  renamed to `.card` (a plain CSS bordered card, see §3's card-border tokens)
  rather than left as a differently-implemented class with a now-misleading
  name.
- Paper-noise texture backgrounds (`--noise-texture` and its use on `body`)
- Torn-paper `clip-path` edges
- Pin/pushpin icons
- Handwriting fonts (BMYEONSUNG/Yeonseong, Caveat)

Shadows stay minimized — cards use a border (`.card`, §3), not a shadow, for
separation from the page background. Where depth is still needed, keep it
faint; the removed hand-drawn borders were not replaced with a heavier
shadow system.

## Rollout status

**Fully migrated (2026-09-19).** Every section — cover, header/nav, realtime
grid, big-events cards, features, search/filter, hot ranking, account link,
footer — is now on this design system: `.card` borders, the warm palette,
Pretendard throughout, zero Rough.js. There is no more "old system" section
left to migrate.

Open threads for a future pass, not blockers for this one:
- Only `h1`/`.logo` are weight 900 (§2) — `h2`/`h3` are still 700.
- The custom mascot vs. Open Peeps question in §1 is unresolved.
- `.card:hover`'s border-brighten affects every `.card`, including ones that
  aren't otherwise interactive (e.g. `.feature-card`, `.account-card`) — kept
  for a consistent brand touch across all cards rather than special-casing
  which ones "deserve" it, but worth revisiting if it ever reads as a false
  affordance on a card that does nothing on click.
