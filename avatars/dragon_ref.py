# Boss dragon as pixel art made from a reference drawing (a person's fan art of a crouching dragon with a tail flame; the
# reference itself is not in this repo). Removes the white background, recolours (crimson body, amber underside, violet
# wings, orange flame: the original's dark grey would vanish on the forest), shrinks to H pixels tall, limits the palette,
# adds a dark outline. Frames: idle, idle-1 (1px lower), attack (flame brighter), hit (pink), sleep (darker, "z").
#   python avatars/dragon_ref.py <reference image> avatars/dragon.json, then node avatars/build.mjs
import colorsys, json, sys
from PIL import Image, ImageFilter

H = 64
src = Image.open(sys.argv[1]).convert("RGB")
W0, H0 = src.size
px = src.load()

# 1. silhouette: everything that is not near-white
alpha = Image.new("L", src.size, 0)
ap = alpha.load()
for y in range(H0):
    for x in range(W0):
        ap[x, y] = min(255, max(0, (255 - min(px[x, y])) * 4 - 40))
box = alpha.point(lambda v: 255 if v > 90 else 0).getbbox()
src, alpha = src.crop(box), alpha.crop(box)
W0, H0 = src.size
px, ap = src.load(), alpha.load()

# 2. recolour full size (before shrinking, so the shrink averages the new colours)
def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
RAMPS = {"body": ((28, 2, 12), (196, 40, 54)), "belly": ((214, 120, 40), (255, 214, 120)),
         "wing": ((50, 28, 110), (160, 120, 240)), "flame": ((214, 60, 14), (255, 196, 60))}
out = Image.new("RGB", src.size)
op = out.load()
flame = set()
for y in range(H0):
    for x in range(W0):
        r, g, b = px[x, y]
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        if b > r + 18 and b > g - 10:                                    # a blue part: flame, wing or underside
            if x < W0 * 0.34 and y > H0 * 0.62: kind = "flame"
            elif l > 0.62: kind = "belly"
            else: kind = "wing"
            t = min(1, max(0, (l - 0.62) / 0.3)) if kind == "belly" else min(1, max(0, (l - 0.4) / 0.4)) if kind == "flame" else min(1, max(0, (l - 0.15) / 0.5))
        else:                                                            # grey body: darks stay dark, lit edges go bright
            kind, t = "body", min(1, max(0, (l - 0.08) / 0.26)) ** 0.9
        op[x, y] = lerp(*RAMPS[kind], t)
        if kind == "flame": flame.add((x, y))

# 3. shrink with the alpha premultiplied, then cut the edge at half coverage
W = round(W0 * H / H0)
small = Image.new("RGBA", (W, H))
sp = small.load()
cell_w, cell_h = W0 / W, H0 / H
for y in range(H):
    for x in range(W):
        x0, x1, y0, y1 = int(x * cell_w), max(int(x * cell_w) + 1, int((x + 1) * cell_w)), int(y * cell_h), max(int(y * cell_h) + 1, int((y + 1) * cell_h))
        n = tot = fl = 0
        acc = [0, 0, 0]
        for yy in range(y0, min(y1, H0)):
            for xx in range(x0, min(x1, W0)):
                a = ap[xx, yy] / 255
                n += 1; tot += a
                fl += a if (xx, yy) in flame else 0
                for i in range(3): acc[i] += op[xx, yy][i] * a
        if n and tot / n >= 0.5:
            sp[x, y] = tuple(round(acc[i] / tot) for i in range(3)) + (255,)
alpha_small = small.getchannel("A")

# 4. limit the palette (a dozen colours), keep it crisp
rgb = Image.new("RGB", (W, H), (0, 0, 0))
rgb.paste(small.convert("RGB").filter(ImageFilter.UnsharpMask(radius=1.2, percent=220, threshold=2)), mask=alpha_small)
q = rgb.quantize(colors=13, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
cells = [[(q.getpixel((x, y)) if alpha_small.getpixel((x, y)) else None) for x in range(W)] for y in range(H)]

# 5. outline: the empty cells touching the figure
OUT = (26, 10, 16)
PAD = 2
cells = [[None] * (W + 2 * PAD) for _ in range(PAD)] + [[None] * PAD + r + [None] * PAD for r in cells] + [[None] * (W + 2 * PAD) for _ in range(PAD)]
HH, WW = len(cells), len(cells[0])
edge = {(x, y) for y in range(HH) for x in range(WW) if cells[y][x] is None and any(
    0 <= y + dy < HH and 0 <= x + dx < WW and cells[y + dy][x + dx] is not None for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
for x, y in edge: cells[y][x] = OUT

# 6. frames
def shift(c, dy): return [[None] * WW for _ in range(dy)] + [r[:] for r in c[:HH - dy]]
def mapc(c, fn): return [[fn(v, x, y) if v is not None else None for x, v in enumerate(r)] for y, r in enumerate(c)]
is_flame = lambda v, x, y: x < WW * 0.34 and y > HH * 0.6 and v[0] > 150 and v[2] < 140 and v != OUT
bright = lambda v, x, y: lerp(v, (255, 245, 160), 0.55) if is_flame(v, x, y) else v
pink = lambda v, x, y: v if v == OUT else (255, 154, 168)
dark = lambda v, x, y: lerp(v, (10, 6, 20), 0.45) if v != OUT else v
Z = (207, 216, 255)
def with_z(c, f):
    z = ["ZZZZ", "..Z.", ".Z..", "ZZZZ"]
    c = [r[:] for r in c]
    for dy, row in enumerate(z):
        for dx, ch in enumerate(row):
            if ch == "Z" and 0 <= 3 + f * 4 + dy < HH: c[3 + f * 4 + dy][2 + dx] = Z
    return c
idle = cells
frames = {"dragon-idle": idle, "dragon-idle-1": shift(idle, 1), "dragon-attack": mapc(idle, bright), "dragon-hit": mapc(idle, pink),
          "dragon-sleep": with_z(mapc(idle, dark), 0), "dragon-sleep-1": with_z(mapc(idle, dark), 1), "dragon-sleep-2": with_z(mapc(idle, dark), 2)}

letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
colours = []
for c in frames.values():
    for r in c:
        for v in r:
            if v is not None and v not in colours: colours.append(v)
assert len(colours) <= len(letters), len(colours)
pal = {letters[i]: "#%02x%02x%02x" % v for i, v in enumerate(colours)}
code = {v: letters[i] for i, v in enumerate(colours)}
print(f"{WW}x{HH}, {len(colours)} colours")
json.dump({"palette": pal, "avatars": {n: ["".join(code[v] if v is not None else "." for v in r) for r in c] for n, c in frames.items()}},
          open(sys.argv[2], "w"), indent=2)
