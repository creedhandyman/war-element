# Card art

Moved out of CLAUDE.md to keep it short. Same text, same rules — read it before working in this area.

## Card art — the convention is HEIGHT 1000, not a fixed 750x1000

Measured across `public/cards` (384 plates): 750x1000 (117) · 800x1000 (92) ·
667x1000 (59) · 706x1000 (23) · 666x1000 (18) · 714x1000 (11) · 701x1000 (9) ·
1086x1448 (8). So the rule is **1000px tall, width whatever the source's aspect
wants** — the widths vary because the ART varies, not because anything drifted.

This bit once: replacing Halo, a flat resize to 750x1000 was applied to a
1122x1402 source (aspect 0.80) and SQUASHED it. The right conversion is

```py
tw = round(w / h * 1000); im.resize((tw, 1000), Image.LANCZOS)
```

which put it at 800x1000 — a size 92 other plates already use. Sources that are
1086x1448 are aspect 0.75 exactly, so a 750x1000 resize is lossless for those
and that is why the boss plates came out right; it is luck, not the rule.

Every renderer uses `object-fit: cover` (or `contain` in the gallery lightbox),
so a wrong aspect does not error — it just quietly looks wrong. Nothing catches
it: `art.test.ts` checks the FILE EXISTS and that the name is lowercase, not its
shape.

## Art is drawn from a SMALL COPY — `tools/make-thumbs.py`

A browser decodes an image at its **natural** size however small it is drawn.
Every surface used to point at the 1000px plate, so, measured in the running
game with a `PerformanceObserver` and a walk over `document.images`:

| screen | images | decoded bitmap |
| --- | --- | --- |
| gallery, scrolled two screens | 237 | **694 MB** |
| a match in progress | 12 | 25 MB |

For tiles 78-96px wide, a 96px hand card, a 26px revealed card and a 20-26px
spell chip. That, not the engine, is what made phones stutter: the same walk
during a turn found ZERO long tasks and sub-millisecond clicks, and 5,600-match
harness runs put a whole AI game at ~0.2s.

`tools/make-thumbs.py` writes `public/cards/thumb` at 500px tall (103 -> 20.5
MB) and `public/spells/thumb` at 240px (12.2 -> 1.2 MB). `cardThumbSrc` /
`spellThumbSrc` in `shared.ts` are what every surface calls; `cardArtSrc` /
`spellArtSrc` remain for the three that genuinely show the art big — the card
detail view, the gallery lightbox, the cast flash. Same screens after: 165 MB
and 6.1 MB, both -76%.

**Run the script after dropping art in**, and commit the copy: `art.test.ts`
fails without one, because a missing copy is the same silent nothing as missing
art — an empty tile, no error. `.deck-thumb` also carries `content-visibility:
auto`, so the ~400 offscreen tiles are never laid out.

The narrowest plate aspect (667x1000) gives a 334px-wide copy, which is exactly
a 111px gallery tile at 3x — the tile size measured at a 375px viewport. If art
ever reads soft on a high-DPI tablet, raise `SIZES["cards"]` and re-run with
`--force`; that is the number to move, not the call sites.
