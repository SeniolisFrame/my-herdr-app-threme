# Turns the Pixellab sprites in avatars/pixellab/ into what herdr draws:
#   mods/kage-agents/<class>-awake|awake-mid|awake-down|sleep|sleep-1|sleep-2.png   64x64 card portraits (native size)
#   mods/kage-agents/<class>-icon.png                                                24x24 head for the menus
#   mods/kage-agents/<class>-atk-<0..8>.png                                           the attack, drawn in the tab bar (scaled SCALE x)
#   mods/kage-agents/dragon-idle|idle-1|attack|hit|sleep-1.png, dragon-icon.png
#   mods/kage-tabs/sprites.js                                                         sizes the tab bar scene needs
# Skin is recoloured: pale for everyone but the rogue (tan). A class with no attack frames yet holds its standing sprite.
#   python avatars/build_pixellab.py
import colorsys, os, json
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "pixellab")
OUT = os.path.join(HERE, "..", "mods", "kage-agents")
TABS = os.path.join(HERE, "..", "mods", "kage-tabs")
SCALE = 1.5
CLASSES = ["swordsman", "rogue", "priest", "reaper", "witch", "spear"]
TONE = {"rogue": "tan"}                                   # everyone else is pale
HIT = {"swordsman": [4, 5, 6], "rogue": [6, 7, 8], "spear": [3, 4, 5, 6]}   # attack frames where the blow lands
RIM = (130, 150, 190)

def load(name): return Image.open(os.path.join(SRC, name)).convert("RGBA")

def recolor(im, mode):
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a < 10: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            if not (0.03 < h < 0.085 and 0.35 < s < 0.9 and 0.42 < l < 0.85): continue
            if mode == "pale": l, s, h = l + (1 - l) * 0.55, s * 0.45, 0.055
            else: l, s, h = l * 0.86, s * 0.8, 0.07
            r, g, b = colorsys.hls_to_rgb(h, min(l, 0.97), min(s, 1))
            px[x, y] = (round(r * 255), round(g * 255), round(b * 255), a)
    return im

def box(im): return im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()

def scaled(im, k): return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.NEAREST)

def darken(im, t=0.4):
    im = im.copy(); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a: px[x, y] = (round(r * (1 - t) + 8 * t), round(g * (1 - t) + 8 * t), round(b * (1 - t) + 24 * t), a)
    return im

def zmarks(im, f):
    im = im.copy(); d = ImageDraw.Draw(im)
    x0, y0 = 4 + f * 3, 4 + f * 5
    for dy, row in enumerate(["ZZZZ", "..Z.", ".Z..", "ZZZZ"]):
        for dx, ch in enumerate(row):
            if ch == "Z": d.point((x0 + dx, y0 + dy), fill=(207, 216, 255, 255))
    return im

def crop_at(im, cx, top, w, h):
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    out.paste(im, (w // 2 - cx, -top))
    return out

def head_x(im, y0, rows=14):
    a = im.getchannel("A"); xs = [x for y in range(y0, y0 + rows) for x in range(im.width) if a.getpixel((x, y)) > 20]
    return round(sum(xs) / len(xs)) if xs else im.width // 2

SPR = {}
os.makedirs(OUT, exist_ok=True)
for c in CLASSES:
    names = [f"{c}_attack_{i}.png" for i in range(9)]
    have = all(os.path.exists(os.path.join(SRC, n)) for n in names)
    frames = [load(n) for n in names] if have else [load(f"{c}_east.png")] * 9
    frames = [recolor(f, TONE.get(c, "pale")) for f in frames]
    boxes = [box(f) for f in frames]
    u = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
    for i, f in enumerate(frames): scaled(f.crop(u), SCALE).save(os.path.join(OUT, f"{c}-atk-{i}.png"))
    sw, sh = scaled(frames[0].crop(u), SCALE).size
    SPR[c] = {"w": sw, "h": sh, "n": 9 if have else 1, "hit": HIT.get(c, [3, 4, 5]), "moves": have}
    # card portrait: the top 64x64 of the standing sprite, native size
    f0 = frames[0]; b0 = box(f0); cx = head_x(f0, b0[1])
    card = crop_at(f0, cx, b0[1] - 4, 64, 64)
    asleep = darken(card)
    for n in ("awake", "awake-mid", "awake-down"): card.save(os.path.join(OUT, f"{c}-{n}.png"))
    for i, n in enumerate(("sleep", "sleep-1", "sleep-2")): zmarks(asleep, i).save(os.path.join(OUT, f"{c}-{n}.png"))
    crop_at(f0, cx, b0[1] - 1, 24, 24).save(os.path.join(OUT, f"{c}-icon.png"))
    print(c, "frames" if have else "standing only", (sw, sh))

REF = os.path.join(HERE, "dragon_ref_frames.json")      # the black dragon made from the reference drawing (the one the user likes best)
if os.path.exists(REF):
    data = json.load(open(REF)); K = 3
    def frame(name):
        rows = data["avatars"][name]; im = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0)); px = im.load()
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != ".":
                    c = data["palette"][ch]; px[x, y] = (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255)
        return im.resize((im.width * K, im.height * K), Image.NEAREST)
    for name, out in (("dragon-idle", "dragon-idle"), ("dragon-idle-1", "dragon-idle-1"), ("dragon-attack", "dragon-attack"), ("dragon-hit", "dragon-hit"), ("dragon-sleep-1", "dragon-sleep-1")):
        frame(name).save(os.path.join(OUT, out + ".png"))
    big = frame("dragon-idle")
    Image.open(os.path.join(OUT, "dragon-idle.png")).crop((0, 24 * K, 40 * K, 64 * K)).resize((24, 24), Image.NEAREST).save(os.path.join(OUT, "dragon-icon.png"))
    SPR["dragon"] = {"w": big.width, "h": big.height, "mouthX": 24 * K, "mouthY": 38 * K}
    print("dragon (reference version)", big.size)
else:
    # the dragon: a pale rim so a dark body reads on the dark forest, then SCALE x; hit = pink, asleep = dark with z marks
    d = load("dragon.png")
    b = box(d); d = d.crop(b)
    rim = Image.new("RGBA", (d.width + 4, d.height + 4), (0, 0, 0, 0)); rim.paste(d, (2, 2))
    a = rim.getchannel("A"); edge = Image.new("RGBA", rim.size, (0, 0, 0, 0)); ep = edge.load(); ap = a.load()
    for y in range(rim.height):
        for x in range(rim.width):
            if ap[x, y] < 20 and any(0 <= x + dx < rim.width and 0 <= y + dy < rim.height and ap[x + dx, y + dy] > 20 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): ep[x, y] = RIM + (255,)
    edge.alpha_composite(rim); rim = edge
    pad = 3
    def padded(im, dy=0):
        out = Image.new("RGBA", (im.width, im.height + pad), (0, 0, 0, 0)); out.paste(im, (0, pad + dy)); return out
    big = scaled(rim, SCALE)
    pink = big.copy(); pp = pink.load()
    for y in range(pink.height):
        for x in range(pink.width):
            r, g, bl, al = pp[x, y]
            if al and (r + g + bl) > 150: pp[x, y] = (255, 154, 168, al)
    sleepy = darken(big, 0.45)
    padded(big, 0).save(os.path.join(OUT, "dragon-idle.png")); padded(big, 3).save(os.path.join(OUT, "dragon-idle-1.png"))
    padded(big, 0).save(os.path.join(OUT, "dragon-attack.png")); padded(pink, 0).save(os.path.join(OUT, "dragon-hit.png"))
    zmarks(padded(sleepy, 3), 0).save(os.path.join(OUT, "dragon-sleep-1.png"))
    hx, hy = 38, 40                                           # the head in the source drawing, for the menu icon
    Image.open(os.path.join(SRC, "dragon.png")).convert("RGBA").crop((b[0], b[1], b[0] + 48, b[1] + 48)).resize((24, 24), Image.NEAREST).save(os.path.join(OUT, "dragon-icon.png"))
    # mouth: about (9, 64) in the 192x128 source; minus the crop, plus the rim, times SCALE
    SPR["dragon"] = {"w": big.width, "h": big.height + pad, "mouthX": round((9 - b[0] + 2) * SCALE), "mouthY": round((64 - b[1] + 2) * SCALE) + pad}
    print("dragon", big.size, SPR["dragon"])

with open(os.path.join(TABS, "sprites.js"), "w") as f:
    f.write("// Written by avatars/build_pixellab.py: the size of each sprite the tab bar scene draws.\nexport const SPR = " + json.dumps(SPR, indent=2) + ";\n")
