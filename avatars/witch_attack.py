# Makes the Agents card art from the Pixellab frames in avatars/pixellab/ (front-facing witch2), 96x96, drawn 1:1:
#   mods/kage-agents/witch-atk-0..8.png  the cast, while an agent works
#   avatars/witch-sleep, -1, -2.png      asleep (sleep frames 1..3; frame 0 stands)
# All use one crop and one scale (nearest) so she is the same size in every frame; skin is paled.
#   python avatars/witch_attack.py
import os, colorsys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "mods", "kage-agents")

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
fr = [load(f"witch_front_attack_{i}.png") for i in range(9)]
box = [min(b[0] for b in map(lambda f: f.getbbox(), fr)), min(b[1] for b in map(lambda f: f.getbbox(), fr)),
       max(b[2] for b in map(lambda f: f.getbbox(), fr)), max(b[3] for b in map(lambda f: f.getbbox(), fr))]
w, h = box[2] - box[0], box[3] - box[1]
S = 96
s = min((S - 4) / w, (S - 4) / h)
for i, f in enumerate(fr):
    c = f.crop(box).resize((round(w * s), round(h * s)), Image.NEAREST)
    out = Image.new("RGBA", (S, S)); out.paste(c, ((S - c.width) // 2, S - 2 - c.height), c)
    out.save(os.path.join(OUT, f"witch-atk-{i}.png"))
print(w, h, s)

for n, i in zip(["sleep", "sleep-1", "sleep-2"], [1, 2, 3]):
    f = load(f"witch_front_sleep_{i}.png")
    c = f.crop(box).resize((round(w * s), round(h * s)), Image.NEAREST)
    out = Image.new("RGBA", (S, S)); out.paste(c, ((S - c.width) // 2, S - 2 - c.height), c)
    out.save(os.path.join(HERE, f"witch-{n}.png"))
