# Card art drop folder

Drop one image per card here, named `<card id>.webp` — it appears
automatically on board tokens, hand cards, and the mulligan screen.
No file = the flat colored token (nothing breaks). Add art one card at a
time; unnamed cards keep the fallback.

**`.webp`, not `.png`.** The loader builds `/cards/<id>.webp` with the
extension hard-coded, and `engine/__tests__/art.test.ts` only globs `*.webp`
— so a `.png` dropped here is invisible to both. It does not 404 loudly, it
just silently keeps the fallback token, which is exactly the failure that
test was written to catch. This file used to say `.png` and all 344 arts on
disk are `.webp`; the instruction was the thing that was wrong.

Convert after exporting (Pillow, one line):

```python
from PIL import Image
im = Image.open("dawn_sphere.png").convert("RGB")
w = round(im.width * 1000 / im.height)          # every art here is 1000px tall
im.resize((w, 1000), Image.LANCZOS).save("dawn_sphere.webp", "WEBP", quality=86, method=6)
```

Then delete the `.png`. `public/` ships verbatim, so a 3 MB source left
behind is 3 MB served to every visitor for a file nothing reads.

## How to export from Canva

1. Open the card page → **Share → Download → PNG**, one page/card at a time.
2. Export the **artwork only** — no stat badges, cost pips, or ability
   text baked in. The game draws name, ⚔ damage, 🛡 shields, ♥ HP, 👟 speed,
   class, and status pips live on top, over a dark gradient at the bottom
   for readability. (If your Canva page is a full card, duplicate it and
   delete the text/badge layers before exporting, or crop to just the art.)
3. Portrait crop, ~300×360 px or larger. The image is cover-cropped with
   the **top-center kept most visible** — put the creature's face there.
4. Save as `<card id>.png` into this folder (`public/cards/`), convert it to
   `<card id>.webp` with the snippet above, and delete the `.png`. Refresh the
   game — done.

## Filenames — the 38 alpha cards (id → card name)

### LEAF (10)
leaf_sumerose.png  · Sumerose         leaf_squanch.png   · Squanch
leaf_stickviper.png · StickViper       leaf_leaf.png      · Leaf
leaf_greegon.png   · Greegon          leaf_nettle.png    · Nettle
leaf_alpha.png     · Alpha            leaf_thorn.png     · Thorn (Legendary)
leaf_fallona.png   · Fallona          leaf_darth.png     · Darth

### PYRO (9)
pyro_sol.png            · Sol          pyro_sarra.png      · Sarra
pyro_firebird.png       · FireBird     pyro_flamehound.png · Flamehound
pyro_fenrir.png         · Fenrir       pyro_spitfire.png   · Spitfire
pyro_tiki.png           · Tiki         pyro_volcanon.png   · Volcanon (Legendary)
pyro_ember_scorpion.png · Ember Scorpion

### BORE (9)
bore_armadillo.png · Granite Armadillo  bore_rhe.png       · Rhe
bore_clubber.png   · Clubber            bore_rockgoblin.png · Rock Goblin
bore_sandman.png   · Sandman            bore_hillbilly.png · Hillbilly
bore_krysteel.png  · Krysteel           bore_bearocks.png  · Bearocks (Legendary)
bore_smith.png     · Smith

### DUSK (10)
dusk_silkstalker.png · Silkstalker       dusk_haunt.png    · Haunt
dusk_widowbite.png   · Widowbite         dusk_pumpkin.png  · Pumpkin
dusk_vamp.png        · Vamp              dusk_skeleton_knight.png · Skeleton Knight
dusk_gool.png        · Gool              dusk_crow.png     · Crow
dusk_ghastly.png     · Ghastly           dusk_skelider.png · Skelider (Legendary)

### AQUA (10) — new deck
aqua_spinefin.png · Spinefin          aqua_polarking.png · Polar King (Legendary)
aqua_bulletshrimp.png · Bullet Shrimp   aqua_blackbeard.png · BlackBeard
aqua_polarbear.png · PolarBear         aqua_sapphire.png · Sapphire
aqua_owlette.png · Owlette             aqua_coralgolem.png · Coral Golem
aqua_phrost.png · Phrost (Legendary)   aqua_vaporem.png · Vaporem

### DAWN (10) — new deck
dawn_beam.png · Beam         dawn_amble.png · Amble
dawn_flash.png · Flash       dawn_dawn.png · Dawn (Legendary)
dawn_star.png · Star         dawn_veil.png · Veil
dawn_kosmos.png · Kosmos (Legendary)   dawn_lazor.png · Lazor
dawn_solstice.png · Solstice   dawn_clipsey.png · Clipsey

### GALE (10) — new deck
gale_duster.png · Duster     gale_angale.png · Angale
gale_luna.png · Luna         gale_guan.png · Guan
gale_hawk.png · Hawk         gale_wolfbane.png · WolfBane
gale_vaga.png · Vaga         gale_galeon.png · Galeon (Legendary)
gale_buf.png · Buf           gale_klipso.png · Klipso (Legendary)

### BOLT (10) — new deck
bolt_zap.png · Zap           bolt_lytning.png · Lytning
bolt_twotales.png · TwoTales  bolt_sentry.png · Sentry
bolt_zagphu.png · Zagphu     bolt_thundercat.png · ThunderCat
bolt_static.png · Static     bolt_jackarc.png · Jack Arc (Legendary)
bolt_webster.png · Webster   bolt_voltogon.png · Voltogon (Legendary)
