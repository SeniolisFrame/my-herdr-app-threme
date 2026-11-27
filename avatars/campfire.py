"""Campfire for the forest camp: avatars/pixellab/campfire.png (Pixellab pixen, 1 image, a stray stick cut off)
made to flicker by hand: the flame colours roll along a wave, the sparks rise. Writes mods/kage-agents/campfire-0..5.png."""
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
N = 6
base = Image.open(ROOT / "avatars/pixellab/campfire.png").convert("RGBA")
px = base.load()
W, H = base.size
# A stick the generator stood up right of the fire: off.
for y in range(41):
    for x in range(51, W):
        px[x, y] = (0, 0, 0, 0)

fiery = lambda c: c[3] and c[0] > 180 and c[1] > 40 and c[2] < 120
lum = lambda c: c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
ramp = sorted({px[x, y] for y in range(H) for x in range(W) if fiery(px[x, y])}, key=lum)
level = {c: i for i, c in enumerate(ramp)}
# A spark: a fire pixel with no other fire pixel touching it (embers in the air).
def lone(x, y):
    return all(not fiery(px[x + dx, y + dy]) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and 0 <= x + dx < W and 0 <= y + dy < H)
sparks = [(x, y) for y in range(H) for x in range(W) if fiery(px[x, y]) and lone(x, y)]
assert ramp and sparks, "no flame colours or sparks found"

out = ROOT / "mods/kage-agents"
for k in range(N):
    im = base.copy(); q = im.load()
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if fiery(c) and (x, y) not in sparks:
                d = round(1.6 * math.sin(0.7 * x + 0.9 * y - k * 2 * math.pi / N))
                q[x, y] = ramp[max(0, min(len(ramp) - 1, level[c] + d))]
    for i, (x, y) in enumerate(sparks):
        q[x, y] = (0, 0, 0, 0)
        ny = y - (k + i) % N  # rises a pixel a frame, then starts again
        if ny >= 0 and (k + i) % N < N - 1 and q[x, ny][3] == 0:
            q[x, ny] = px[x, y]
    im.save(out / f"campfire-{k}.png")
print(len(ramp), "flame colours,", len(sparks), "sparks")

# The light round the fire, on the ground only: a flat warm oval in hard bands (pixel art, no smooth
# fade), cut at the ground's top edge, a little wider or narrower each frame with the flames.
# 1/4 size, drawn x4: campfire-glow-0..5.png, 400x40, the middle of the fire's ring at 200,16.
GW, GH, CX, CY = 100, 10, 50, 4  # CY: the middle of the stone ring; the rows above it are the ground up to the trees
BANDS = ((0.35, 44), (0.6, 30), (0.85, 17), (1.0, 7))  # (how far out, alpha)
for k in range(N):
    s = 1 + 0.05 * math.sin(k * 2 * math.pi / N)
    im = Image.new("RGBA", (GW, GH)); q = im.load()
    for y in range(GH):
        for x in range(GW):
            t = math.hypot((x - CX) / (48 * s), (y - CY) / (9 * s))
            a = next((al for r, al in BANDS if t < r), 0)
            # Where two bands meet, a checkerboard of both: a dithered edge.
            nxt = next((r for r, _ in BANDS if t < r), None)
            if a and nxt and nxt - t < 0.04 and (x + y) % 2: a = next((al for r, al in BANDS if r > nxt), 0)
            q[x, y] = (255, 150, 60, a) if a else (0, 0, 0, 0)
    im.resize((GW * 4, GH * 4), Image.NEAREST).save(out / f"campfire-glow-{k}.png")
