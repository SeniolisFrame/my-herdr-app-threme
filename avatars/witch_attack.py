# Makes the Agents card art from the Pixellab frames in avatars/pixellab/, 96x96, drawn 1:1, for each witch
# (picked in the Agents menu):
#   witch        front-facing witch2, blue cloak and crystal staff (witch_front_*; asleep: nod_0..7, sitting and nodding)
#   witch-black  black hooded cloak and branch staff (witch_black_*; asleep: sleep_2..4, eyes shut; 0-1 still nod off)
# Each gives mods/kage-agents/<id>-atk-0..8.png (the cast, while an agent works) and avatars/<id>-sleep-0..n.png
# (asleep), and <id>-<move>-0..8.png for her six other moves (<src>_<move>_*). One scale (nearest) per
# witch, from her standing height, so every witch is the same size in every frame; skin is paled.
# Hand-edited sources, keep them: witch_front_nod_* are Pixellab's dozing frames with the head moved down 0-3px; the
# *_circle_* rings were mirrored round the middle of her boots (Pixellab drew them off to the right).
#   python avatars/witch_attack.py
import os, colorsys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "mods", "kage-agents")
S = 96
H = 82  # a standing witch's height on the card

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
MOVES = ["strike", "fireball", "circle", "lightning", "hand", "twirl", "done", "plead"]  # done, plead: the DONE and NEEDS YOU cards
load = lambda n: pale(Image.open(os.path.join(HERE, "pixellab", n)).convert("RGBA"))

for id, src, sleeps in [("witch", "witch_front", [f"nod_{i}" for i in range(8)]), ("witch-black", "witch_black", ["sleep_2", "sleep_3", "sleep_4"])]:
    fr = [load(f"{src}_attack_{i}.png") for i in range(9)]
    bb = [f.getbbox() for f in fr]
    # Every witch standing (attack_0, staff included) is H px tall with her feet 2px off the bottom, so the witches
    # match in size and stand in the middle of the card; whatever reaches past the card is cut off at its edge.
    s = H / (bb[0][3] - bb[0][1])
    x0 = S // 2 - round((bb[0][0] + bb[0][2]) / 2 * s)
    y0 = S - 2 - round(bb[0][3] * s)
    def fit(f, dy=0):
        big = f.resize((round(f.width * s), round(f.height * s)), Image.NEAREST)
        out = Image.new("RGBA", (S, S)); out.alpha_composite(big, (x0, y0 - dy))
        return out
    for i, f in enumerate(fr):
        fit(f).save(os.path.join(OUT, f"{id}-atk-{i}.png"))
    zz = [load(f"{src}_{n}.png") for n in sleeps]
    # Asleep on the ground she lies lower than her feet: lift the whole loop so it stays 2px off the bottom.
    lift = max(0, y0 + max(round(z.getbbox()[3] * s) for z in zz) - (S - 2))
    for k, z in enumerate(zz):
        fit(z, lift).save(os.path.join(HERE, f"{id}-sleep-{k}.png"))
    for move in MOVES:  # her other moves (<src>_<move>_0..8), same scale and place
        for i in range(9):
            fit(load(f"{src}_{move}_{i}.png")).save(os.path.join(OUT, f"{id}-{move}-{i}.png"))
    print(id, s)
