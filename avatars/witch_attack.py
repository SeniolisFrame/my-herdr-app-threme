# Makes the Agents card art from the Pixellab frames in avatars/pixellab/, 96x96, drawn 1:1, for each witch
# (picked in the Agents menu):
#   witch        front-facing witch2, blue cloak and crystal staff (witch_front_*, sleep frames 1..3; 0 stands)
#   witch-black  black hooded cloak and branch staff (witch_black_*, sleep frames 2..4; 0-1 still nod off)
# Each gives mods/kage-agents/<id>-atk-0..8.png (the cast, while an agent works) and avatars/<id>-sleep, -1, -2.png
# (asleep). One crop and one scale (nearest) per witch so she is the same size in every frame; skin is paled.
#   python avatars/witch_attack.py
import os, colorsys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "mods", "kage-agents")
S = 96

def pale(im):  # skin tones (orange-ish hues) lighter and less saturated; hair, cloak and gold are left alone
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 10: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if not (0.03 < h < 0.085 and 0.35 < s < 0.9 and 0.42 < l < 0.85): continue
            r, g, b = colorsys.hls_to_rgb(0.055, min(l + (1 - l) * 0.55, 0.97), s * 0.45)
            px[x, y] = (round(r * 255), round(g * 255), round(b * 255), a)
    return im
load = lambda n: pale(Image.open(os.path.join(HERE, "pixellab", n)).convert("RGBA"))

for id, src, sleeps in [("witch", "witch_front", [1, 2, 3]), ("witch-black", "witch_black", [2, 3, 4])]:
    fr = [load(f"{src}_attack_{i}.png") for i in range(9)]
    bb = [f.getbbox() for f in fr]
    box = [min(b[0] for b in bb), min(b[1] for b in bb), max(b[2] for b in bb), max(b[3] for b in bb)]
    w, h = box[2] - box[0], box[3] - box[1]
    s = min((S - 4) / w, (S - 4) / h)
    def fit(f):
        c = f.crop(box).resize((round(w * s), round(h * s)), Image.NEAREST)
        out = Image.new("RGBA", (S, S)); out.paste(c, ((S - c.width) // 2, S - 2 - c.height), c)
        return out
    for i, f in enumerate(fr):
        fit(f).save(os.path.join(OUT, f"{id}-atk-{i}.png"))
    for n, i in zip(["sleep", "sleep-1", "sleep-2"], sleeps):
        fit(load(f"{src}_sleep_{i}.png")).save(os.path.join(HERE, f"{id}-{n}.png"))
    print(id, w, h, s)
