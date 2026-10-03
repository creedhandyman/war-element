"""Generate the per-element battlefield grounds (public/ground/<el>.webp).

Every texture is SEAMLESS (all noise is FFT-filtered, so it is periodic; every
stamp and stroke is drawn at its wrapped copies too), opaque, and kept dark:
cards sit on top of it and have to stay the brightest thing on a tile.

1024px, built from a HEIGHT map where the surface has relief: lit from the
top-left (the board's key light), with ambient occlusion in the hollows and a
specular term on what should shine (wet asphalt, water, glazed brick). Strokes
(grass) are drawn at 2x and downsampled, so they are anti-aliased.

Run from the repo root:  python tools/make-grounds.py [out_dir] [names...]
Needs numpy + Pillow.
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

N = 1024
S = N / 512          # every length below was tuned at 512px; scale it
SS = 2               # stroke supersampling
OUT = sys.argv[1] if len(sys.argv) > 1 else "public/ground"
LIGHT = np.array([-0.55, -0.55, 0.63]) / np.linalg.norm([-0.55, -0.55, 0.63])
HALF = (LIGHT + np.array([0, 0, 1.0])) / np.linalg.norm(LIGHT + np.array([0, 0, 1.0]))

_fy = np.fft.fftfreq(N)[:, None]
_fx = np.fft.fftfreq(N)[None, :]
_K = np.sqrt(_fx * _fx + _fy * _fy) + 1e-9
YY, XX = np.mgrid[0:N, 0:N].astype(float)


# ── primitives ───────────────────────────────────────────────────────────────
def noise(seed, lo, power=1.0, aniso=None):
    """Periodic band-limited noise in [0,1]. `lo` = smallest wavelength kept
    (px at 512, scaled); `power` tilts toward large features; `aniso`
    = (angle_deg, stretch) elongates features along that angle."""
    r = np.random.default_rng(seed)
    f = np.fft.fft2(r.standard_normal((N, N)))
    k = _K
    if aniso:
        a = math.radians(aniso[0])
        u = _fx * math.cos(a) + _fy * math.sin(a)
        v = -_fx * math.sin(a) + _fy * math.cos(a)
        k = np.sqrt((u * aniso[1]) ** 2 + v ** 2) + 1e-9
    m = np.exp(-(k * lo * S) ** 2) if lo else np.ones_like(k)
    if power:
        m = m / (k ** power)
    m[0, 0] = 0
    n = np.real(np.fft.ifft2(f * m))
    return (n - n.min()) / (n.max() - n.min())


def fbm(seed, octaves, power=0.9):
    """A few octaves of noise summed, finer ones weaker — natural roughness."""
    out = np.zeros((N, N))
    amp, tot = 1.0, 0.0
    for i, w in enumerate(octaves):
        out += noise(seed + i * 101, w, power) * amp
        tot += amp
        amp *= 0.55
    return out / tot


def blur(a, sigma):
    """Periodic gaussian blur (sigma in px at 512)."""
    g = np.exp(-2 * (math.pi * _K * sigma * S) ** 2)
    if a.ndim == 2:
        return np.real(np.fft.ifft2(np.fft.fft2(a) * g))
    return np.stack([blur(a[..., c], sigma) for c in range(a.shape[-1])], -1)


def normals(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    inv = 1 / np.sqrt(dx * dx + dy * dy + 1)
    return -dx * inv, -dy * inv, inv


def lighting(h, strength=3.0, spec_pow=None):
    """(diffuse, specular) from the top-left key light."""
    nx, ny, nz = normals(h, strength / S)
    dif = np.clip(nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2], 0, 1)
    spec = None
    if spec_pow:
        spec = np.clip(nx * HALF[0] + ny * HALF[1] + nz * HALF[2], 0, 1) ** spec_pow
    return dif, spec


def occlusion(h, sigma=6, k=4.0, floor=0.45):
    """Ambient occlusion: darker where the surface sits below its surroundings."""
    return np.clip(1 - np.clip(blur(h, sigma) - h, 0, None) * k, floor, 1)


def ramp(t, stops):
    t = np.clip(t, 0, 1)
    ps = [p for p, _ in stops]
    cs = np.array([c for _, c in stops], float)
    return np.stack([np.interp(t, ps, cs[:, ch]) for ch in range(3)], -1)


def shade(rgb, dif, amb=0.5, ao=None):
    out = rgb * (amb + (1 - amb) * dif[..., None] * 1.35)
    return out * ao[..., None] if ao is not None else out


def cracks(seed, cells=14, warp=30):
    """(distance to the nearest Voronoi edge, cell index), periodic + warped."""
    r = np.random.default_rng(seed)
    pts = r.uniform(0, N, (cells, 2))
    w = (noise(seed + 50, 25, power=0.8) - 0.5) * warp * S
    xx, yy = XX + w, YY + np.roll(w, N // 5, 0)
    d1 = np.full((N, N), 1e9)
    d2 = np.full((N, N), 1e9)
    idx = np.zeros((N, N), int)
    for i, (px, py) in enumerate(pts):
        for ox in (-N, 0, N):
            for oy in (-N, 0, N):
                d = np.hypot(xx - px - ox, yy - py - oy)
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d))
                d1 = np.where(closer, d, d1)
                idx = np.where(closer, i, idx)
    return d2 - d1, idx


def hash01(i, salt=0.0):
    return (np.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1.0


def stamp(field, cx, cy, rad, fn):
    """field += fn(d^2 / rad^2) in a wrapped window around (cx, cy)."""
    R = int(math.ceil(rad)) + 1
    iy = np.arange(int(cy) - R, int(cy) + R + 1)
    ix = np.arange(int(cx) - R, int(cx) + R + 1)
    gy = iy[:, None] - cy
    gx = ix[None, :] - cx
    field[np.ix_(iy % N, ix % N)] += fn((gx * gx + gy * gy) / (rad * rad))


def contact_shadow(mask, sigma=1.2, reach=1.6):
    """Soft shadow a raised thing casts down-right, away from the key light."""
    sh = int(round(reach * S))
    return np.clip(blur(np.roll(np.roll(mask, sh, 0), sh, 1), sigma) - mask, 0, 1)


def dome(t):
    return np.sqrt(np.clip(1 - t, 0, 1))


def disc(v):
    return lambda t: np.where(t < 1, v, 0.0)


def strokes_layer(base_rgb, items):
    """Draw anti-aliased, seamlessly wrapped blades over `base_rgb` (N×N×3)."""
    big = Image.fromarray(np.clip(base_rgb, 0, 255).astype(np.uint8), "RGB").resize((N * SS, N * SS), Image.BILINEAR)
    d = ImageDraw.Draw(big)
    M = N * SS
    for it in items:
        xs, ys = it["xs"], it["ys"]
        offx = [0] + ([M] if min(xs) < 0 else []) + ([-M] if max(xs) >= M else [])
        offy = [0] + ([M] if min(ys) < 0 else []) + ([-M] if max(ys) >= M else [])
        for ox in offx:
            for oy in offy:
                for i in range(3):
                    w = max(1, int(round(it["w"] * (1 - i * 0.28))))
                    d.line((xs[i] + ox, ys[i] + oy, xs[i + 1] + ox, ys[i + 1] + oy), fill=it["cols"][i], width=w)
    return np.asarray(big.resize((N, N), Image.LANCZOS)).astype(float)


def blade(x, y, length, angle, bend, col_root, col_tip, width):
    """A curved blade as a 3-segment polyline, dark at the root, light at the tip."""
    xs, ys = [x * SS], [y * SS]
    a = angle
    for _ in range(3):
        a += bend / 3
        xs.append(xs[-1] + math.cos(a) * length * SS / 3)
        ys.append(ys[-1] + math.sin(a) * length * SS / 3)
    cols = [tuple(int(c0 + (c1 - c0) * t) for c0, c1 in zip(col_root, col_tip)) for t in (0.15, 0.55, 0.95)]
    return {"xs": xs, "ys": ys, "cols": cols, "w": width}


def mul(c, g):
    return tuple(int(v * g) for v in c)


def save(name, rgb):
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    Image.fromarray(rgb, "RGB").save(f"{OUT}/{name}.webp", quality=86, method=6)


# ── LEAF: a grass meadow ─────────────────────────────────────────────────────
def leaf():
    r = np.random.default_rng(11)
    soil_h = fbm(1, [3, 8, 20])
    soil = shade(ramp(noise(2, 30, 0.6), [(0, (20, 22, 10)), (1, (34, 34, 16))]), lighting(soil_h, 3)[0], 0.6)
    density = noise(3, 35, 0.7)                     # clumps and thinner patches
    lush = noise(4, 60, 0.5)                        # broad colour drift
    items = []
    for _ in range(62000):
        x, y = r.uniform(0, N, 2)
        if r.random() > 0.35 + 0.75 * density[int(y), int(x)]:
            continue
        g = r.uniform(0.7, 1.25)
        l = lush[int(y), int(x)]
        root = mul((16, 40, 14), g)
        tip = mul((52 + 30 * l, 112 + 26 * l, 34 + 6 * l), g)
        if r.random() < 0.05:                       # a dry blade
            tip = mul((132, 124, 58), g)
        items.append(blade(x, y, r.uniform(9, 20) * S, math.radians(r.normal(-90, 16)),
                           math.radians(r.normal(0, 22)), root, tip, int(r.choice([2, 3, 3]))))
    items.sort(key=lambda it: it["ys"][0])         # nearer (lower) blades over farther
    a = strokes_layer(soil, items)
    flowers = np.zeros((N, N, 3))
    fm = np.zeros((N, N))
    for _ in range(140):                            # clover and tiny flowers, sparse
        x, y = r.uniform(0, N, 2)
        c = np.array([(222, 210, 120), (200, 160, 205), (232, 232, 214)][r.integers(0, 3)]) * 0.72
        m = np.zeros((N, N))
        for k in range(5):
            stamp(m, x + math.cos(k * 1.2566) * 1.6 * S, y + math.sin(k * 1.2566) * 1.6 * S, 1.3 * S,
                  lambda t: np.clip(1 - t, 0, 1))
        m = np.clip(m, 0, 1)
        flowers += m[..., None] * c
        fm = np.maximum(fm, m)
    a = a * (1 - fm[..., None] * 0.9) + flowers * 0.9
    lum = a.mean(-1) / 255
    a = shade(a, lighting(blur(lum, 0.6), 2.5)[0], 0.72, occlusion(lum, 4, 2.2, 0.6))
    a *= (0.72 + 0.42 * noise(5, 70, 0.5))[..., None]   # cloud shadow and sun patches
    save("leaf", a * 1.12)


# ── PYRO: cracked basalt with ember seams ────────────────────────────────────
def pyro():
    r = np.random.default_rng(5)
    e, cell = cracks(7, 12)
    plate = ((hash01(cell, 1) - 0.5) * XX + (hash01(cell, 2) - 0.5) * YY) / N * 0.25 + hash01(cell, 3) * 0.12
    plate = blur(plate, 1.2)                         # each plate tilts its own way
    rough = fbm(10, [1.5, 4, 10])
    h = rough * 0.55 + plate
    vesicles = np.zeros((N, N))                      # gas pits in the basalt
    for _ in range(900):
        stamp(vesicles, *r.uniform(0, N, 2), r.uniform(0.8, 2.6) * S, lambda t: -dome(t))
    h += vesicles * 0.18
    seam = np.exp(-(e / (2.4 * S)) ** 2)
    h -= seam * 0.6
    dif, _ = lighting(h, 4.5)
    base = ramp(rough * 0.6 + hash01(cell, 4) * 0.4, [(0, (16, 13, 13)), (0.5, (36, 30, 28)), (1, (60, 50, 44))])
    a = shade(base, dif, 0.45, occlusion(h, 3, 5, 0.35))
    ash = np.clip(noise(11, 25, 0.7) * 1.8 - 1.0, 0, 1) * (1 - seam)   # pale ash on the plates
    a = a * (1 - ash[..., None] * 0.35) + ash[..., None] * np.array([70, 64, 60]) * 0.35
    heat = 0.55 + 0.45 * noise(12, 30, 0.5)
    a = a * (1 - seam[..., None] * 0.85)
    a += (blur(seam, 5) * heat)[..., None] * np.array([130, 34, 6]) * 0.75
    a += (np.exp(-(e / (2.8 * S)) ** 2) * heat)[..., None] * np.array([170, 56, 8]) * 0.6
    a += (np.exp(-(e / (1.1 * S)) ** 2) * heat)[..., None] * np.array([150, 120, 40]) * 0.55
    sparks = np.zeros((N, N))                        # embers caught along the seams
    for _ in range(600):
        x, y = r.uniform(0, N, 2)
        if e[int(y), int(x)] < 10 * S:
            stamp(sparks, x, y, r.uniform(0.6, 1.4) * S, lambda t: np.clip(1 - t, 0, 1))
    a += np.clip(sparks, 0, 1)[..., None] * np.array([200, 120, 40]) * 0.6
    save("pyro", a)


# ── AQUA: shallow water over rippled sand ────────────────────────────────────
def aqua():
    r = np.random.default_rng(9)
    warp = (noise(13, 30, 0.8) - 0.5) * 60 * S
    ripples = 0.5 + 0.5 * np.sin((YY + warp) / N * 2 * math.pi * 44 + XX / N * 2 * math.pi * 3)
    sand_h = ripples * 0.16 + noise(14, 0.8, 0.2) * 0.3 + fbm(15, [4, 12]) * 0.54
    pebbles = np.zeros((N, N))
    for _ in range(90):
        stamp(pebbles, *r.uniform(0, N, 2), r.uniform(2, 5) * S, dome)
    sand_h += np.clip(pebbles, 0, 1) * 0.3
    dif, _ = lighting(sand_h, 2.6)
    depth = noise(16, 70, 0.5)                       # deeper water reads bluer, darker
    bed = ramp(sand_h * 0.5 + depth * 0.5, [(0, (18, 50, 60)), (0.5, (28, 74, 84)), (1, (44, 98, 102))])
    a = shade(bed, dif, 0.6, occlusion(sand_h, 4, 3, 0.6))
    c1, _ = cracks(17, 70, warp=40)                  # caustics: the bright web of light
    c2, _ = cracks(18, 46, warp=50)
    caustic = np.exp(-(c1 / (1.3 * S)) ** 2) * 0.7 + np.exp(-(c2 / (1.8 * S)) ** 2) * 0.5
    caustic = blur(caustic, 0.5) * (0.6 + 0.6 * noise(19, 40, 0.5))
    a += caustic[..., None] * np.array([70, 150, 160]) * 0.55
    _, spec = lighting(noise(20, 6, 1.0), 6, spec_pow=60)   # glints off the surface
    a += spec[..., None] * np.array([150, 210, 220]) * 0.35
    a *= (0.9 - depth * 0.25)[..., None]
    save("aqua", a * 1.08)


# ── GALE: orange plains, combed by the wind ──────────────────────────────────
def gale():
    r = np.random.default_rng(13)
    soil_h = fbm(21, [3, 10])
    soil = shade(ramp(noise(22, 50, 0.6), [(0, (72, 38, 12)), (1, (104, 58, 20))]), lighting(soil_h, 3)[0], 0.6)
    rocks = np.zeros((N, N))
    for _ in range(7):
        stamp(rocks, *r.uniform(0, N, 2), r.uniform(4, 10) * S, dome)
    rocks = np.clip(rocks, 0, 1)
    rock_dif, _ = lighting(rocks + noise(23, 1.5, 0.3) * 0.15, 6)
    rock_col = ramp(noise(24, 8), [(0, (66, 58, 52)), (1, (104, 94, 84))])
    m = np.clip(rocks * 4, 0, 1)[..., None]
    soil = soil * (1 - m) + shade(rock_col, rock_dif, 0.4) * m
    streak = noise(25, 12, 0.6, aniso=(-28, 6))      # gust lines combed into the grass
    hue = noise(27, 60, 0.5)                         # amber patches drifting into rust
    items = []
    for _ in range(26000):
        x, y = r.uniform(0, N, 2)
        if rocks[int(y), int(x)] > 0.05:
            continue
        g = r.uniform(0.75, 1.25) * (0.8 + 0.4 * streak[int(y), int(x)])
        h = hue[int(y), int(x)]
        root = mul((84, 40, 12), g)
        tip = mul((240 + 15 * h, 136 + 40 * h, 36 + 14 * h), g)
        roll = r.random()
        if roll < 0.18:                              # a sun-bleached straw blade
            tip = mul((214, 170, 96), g)
        elif roll < 0.3:                             # a deep rust one
            tip = mul((150, 58, 22), g)
        items.append(blade(x, y, r.uniform(14, 30) * S, math.radians(r.normal(-72, 10)),
                           math.radians(r.normal(30, 10)), root, tip, int(r.choice([2, 3]))))
    items.sort(key=lambda it: it["ys"][0])
    a = strokes_layer(soil, items)
    lum = a.mean(-1) / 255
    a = shade(a, lighting(blur(lum, 0.6), 2)[0], 0.75, occlusion(lum, 4, 2, 0.65))
    a *= (0.78 + 0.32 * noise(26, 70, 0.4))[..., None]
    save("gale", a * 1.0)


# ── BOLT: city asphalt under violet neon ─────────────────────────────────────
def bolt():
    r = np.random.default_rng(16)
    binder = fbm(30, [0.8, 2.5, 8], power=0.4)
    stones = np.zeros((N, N))
    tone = np.zeros((N, N))
    for _ in range(16000):                           # the aggregate, small and flush
        x, y = r.uniform(0, N, 2)
        rad = r.uniform(0.5, 1.4) * S
        stamp(stones, x, y, rad, dome)
        stamp(tone, x, y, rad, disc(r.uniform(-0.5, 1.0)))
    stones = np.clip(stones, 0, 1)
    h = binder * 0.35 + stones * 0.16
    e, _ = cracks(31, 7)
    tar = np.exp(-(e / (1.6 * S)) ** 2)
    h -= tar * 0.3
    puddle = np.clip((noise(32, 45, 0.8) * 2.6 - 1.75) * 3, 0, 1)
    h = h * (1 - puddle) + blur(h, 3) * puddle * 0.5          # water levels the surface
    dif, spec = lighting(h, 5, spec_pow=18)
    base = ramp(noise(33, 70, 0.5), [(0, (22, 23, 25)), (1, (38, 39, 42))])
    a = shade(base, dif, 0.55, occlusion(binder * 0.35 - tar * 0.3, 2, 4, 0.5))
    a += (np.clip(tone, -1, 1) * np.clip(stones * 2, 0, 1))[..., None] * np.array([26, 26, 30])
    a = a * (1 - tar[..., None] * 0.6) + np.exp(-((e - 2.6 * S) / (0.9 * S)) ** 2)[..., None] * np.array([16, 16, 20])
    a += spec[..., None] * np.array([40, 40, 48]) * 0.25 * (1 - puddle[..., None])
    sign = blur(np.clip(noise(34, 18, 0.9) * 2 - 1, 0, 1), 2)  # violet signage, mirrored in the puddles
    a = a * (1 - puddle[..., None] * 0.35) + (puddle * (0.35 + sign))[..., None] * np.array([90, 36, 150]) * 0.6
    sheen = np.clip(noise(35, 40, 0.7) * 1.6 - 0.9, 0, 1) ** 1.5
    a += sheen[..., None] * np.array([70, 30, 110]) * 0.4
    for y0, dash in ((N * 0.28, 70 * S), (N * 0.78, 54 * S)):   # glowing lane dashes
        on = blur((((XX + y0) % (dash * 2)) < dash).astype(float), 0.6)
        d = np.abs(((YY - y0 + N / 2) % N) - N / 2)
        stripe = np.exp(-(d / (2.0 * S)) ** 6) * on
        a = a * (1 - stripe[..., None] * 0.5) + stripe[..., None] * np.array([170, 100, 255]) * 0.95
        a += (blur(stripe, 5) * 1.6)[..., None] * np.array([70, 24, 120])
    save("bolt", a)


# ── BORE: dry packed earth and gravel ────────────────────────────────────────
def bore():
    r = np.random.default_rng(19)
    h = fbm(40, [1.2, 4, 12]) * 0.6
    e, _ = cracks(22, 22)
    h -= np.exp(-(e / (1.6 * S)) ** 2) * 0.35
    drift = np.clip(noise(41, 40, 0.6) * 1.8 - 0.8, 0, 1)    # fine sand settled in the lows
    pebbles = np.zeros((N, N))
    ptone = np.zeros((N, N))
    for _ in range(420):
        x, y = r.uniform(0, N, 2)
        rad = (r.uniform(1.2, 3.0) if r.random() < 0.8 else r.uniform(4, 8)) * S
        stamp(pebbles, x, y, rad, dome)
        stamp(ptone, x, y, rad, disc(r.uniform(-0.6, 0.8)))
    lumpy = noise(42, 1.2, 0.6)                      # break the circles into stones
    pebbles = np.clip(pebbles * (0.6 + 0.8 * lumpy) - 0.15, 0, 1)
    ground_h = h - drift * 0.05
    h = ground_h + pebbles * 0.45
    dif, _ = lighting(h, 4.5)
    base = ramp(noise(23, 50, 0.5), [(0, (66, 48, 32)), (1, (96, 74, 50))])
    base = base * (1 - drift[..., None] * 0.3) + drift[..., None] * np.array([118, 96, 66]) * 0.3
    a = shade(base, dif, 0.48, occlusion(ground_h, 3, 4, 0.45))
    a += (np.clip(pebbles * 3, 0, 1) * np.clip(ptone, -1, 1))[..., None] * np.array([30, 26, 22])
    a *= (1 - contact_shadow(np.clip(pebbles * 3, 0, 1)) * 0.5)[..., None]
    save("bore", a * 0.86)


# ── DUSK: grave soil, dead grass, a violet chill ─────────────────────────────
def dusk():
    r = np.random.default_rng(24)
    h = fbm(50, [1.2, 4, 10]) * 0.7
    clods = np.zeros((N, N))
    for _ in range(320):
        stamp(clods, *r.uniform(0, N, 2), r.uniform(1.5, 4) * S, dome)
    bones = np.zeros((N, N))
    for _ in range(40):                              # pale stones, sparse
        stamp(bones, *r.uniform(0, N, 2), r.uniform(1.2, 2.6) * S, dome)
    h += np.clip(clods, 0, 1) * 0.25 + np.clip(bones, 0, 1) * 0.3
    dif, _ = lighting(h, 4.5)
    base = ramp(noise(27, 45, 0.6), [(0, (24, 18, 30)), (0.6, (38, 30, 44)), (1, (50, 40, 56))])
    a = shade(base, dif, 0.5, occlusion(h, 3, 4, 0.45))
    bm = np.clip(bones * 3, 0, 1)[..., None]
    a = a * (1 - bm) + shade(np.full((N, N, 3), (120, 112, 116), float), dif, 0.4) * bm
    items = []
    for _ in range(5200):                            # dead grass, in tufts
        cx, cy = r.uniform(0, N, 2)
        if r.random() < 0.6:
            for _ in range(int(r.integers(3, 9))):
                g = r.uniform(0.7, 1.2)
                items.append(blade(cx + r.normal(0, 2 * S), cy + r.normal(0, 1 * S), r.uniform(6, 14) * S,
                                   math.radians(r.normal(-90, 28)), math.radians(r.normal(0, 40)),
                                   mul((34, 30, 32), g), mul((96, 86, 80), g), 2))
    items.sort(key=lambda it: it["ys"][0])
    a = strokes_layer(a, items)
    a += (noise(28, 90, 0.4) ** 2)[..., None] * np.array([28, 12, 44])
    save("dusk", a * 0.9)


# ── DAWN: golden bricks ──────────────────────────────────────────────────────
def dawn():
    rows, cols = 10, 4                               # whole bricks per texture, so it tiles
    BH, BW = N / rows, N / cols
    row = np.floor(YY / BH)
    shift = (row % 2) * BW / 2                       # running bond
    col = np.floor(((XX + shift) % N) / BW)
    u = ((XX + shift) % N) - col * BW
    v = YY - row * BH
    k = row * 7919 + col * 104729
    chip = (noise(60, 2.5, 0.9) - 0.5) * 1.8 * S     # irregular, chipped arrises
    edge = np.minimum(np.minimum(u, BW - u), np.minimum(v, BH - v)) + chip
    mortar = np.clip(1 - (edge - 0.5 * S) / (0.8 * S), 0, 1)
    bevel = np.clip(edge / (5 * S), 0, 1) ** 0.5
    tilt = ((hash01(k, 1) - 0.5) * (u / BW) + (hash01(k, 2) - 0.5) * (v / BH)) * 0.18
    r = np.random.default_rng(61)
    pits = np.zeros((N, N))
    for _ in range(1400):
        stamp(pits, *r.uniform(0, N, 2), r.uniform(0.5, 1.4) * S, lambda t: -dome(t))
    face = fbm(62, [1.0, 3, 8]) * 0.45 + np.clip(pits, -1, 0) * 0.08
    h = (bevel * 0.7 + face + tilt) * (1 - mortar) + (noise(63, 0.8, 0.2) * 0.15 - 0.3) * mortar
    dif, spec = lighting(h, 8, spec_pow=24)
    ao = occlusion(h, 3, 3.0, 0.5)
    brick = ramp(hash01(k, 3) * 0.55 + noise(31, 30, 0.6) * 0.25 + fbm(65, [1.5, 5]) * 0.2,
                 [(0, (146, 92, 18)), (0.45, (198, 140, 34)), (1, (236, 184, 64))])
    a = shade(brick, dif, 0.48, ao)
    glaze = (1 - mortar) * (0.5 + 0.5 * hash01(k, 4))   # some bricks are glazed and catch the sun
    a += (spec * glaze)[..., None] * np.array([255, 220, 140]) * 0.22
    grit = ramp(noise(64, 0.8, 0.2), [(0, (66, 54, 38)), (1, (100, 84, 60))])
    a = a * (1 - mortar[..., None]) + shade(grit, dif, 0.8) * mortar[..., None]
    a *= (0.8 + 0.3 * noise(32, 80, 0.4))[..., None]   # soot and sun
    save("dawn", a * 0.66)


ALL = {f.__name__: f for f in (leaf, pyro, aqua, gale, bolt, bore, dusk, dawn)}

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name in (sys.argv[2:] or ALL):
        ALL[name]()
        print(name)
