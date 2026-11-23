# Black boss dragon: drawn big with smooth curves (960x680), then shrunk to a 96x68 pixel sprite (colours limited, pale rim).
# A low predatory crouch, long S neck, a horned head (two swept-back main horns with rings, brow horns, a nose horn, jaw and
# chin spikes), plain clawed arms, bat wings, back spines, a heavy tail. Frames: idle (wing up), idle-1 (wing lower, head dips),
# attack (jaw open, glowing maw), hit (pink), sleep (dark, eye shut, "z").
#   python avatars/dragon_draw.py avatars/dragon.json [preview.png]  then  node avatars/build.mjs
import json, math, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SZ = (960, 680)
S = 10                                                   # drawing px per art px
BONE, BONE_RIM, BONE_SH = (232, 218, 188), (255, 246, 226), (150, 132, 110)
BODY, RIM, SHADE = (30, 33, 50), (96, 116, 168), (12, 13, 22)
BODY2, RIM2, SHADE2 = (22, 24, 38), (70, 86, 130), (8, 9, 16)           # the far side: a little darker
WING, WING_L, WING_D = (34, 44, 112), (64, 92, 176), (20, 26, 72)
AMBER, AMBER_D, EMBER = (236, 150, 52), (170, 92, 30), (255, 150, 40)

def catmull(pts, n=10, closed=False):
    P = list(pts)
    if closed: P = [P[-1]] + P + [P[0], P[1]]
    else: P = [P[0]] + P + [P[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in range(2)))
    if not closed: out.append(P[-2])
    return out

def mask_of(pts):
    m = Image.new("L", SZ, 0)
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m

def blob(pts): return mask_of(catmull(pts, 10, closed=True))

def ribbon(ctrl, widths, off=0.0):
    """A tapering band along a smooth curve; off shifts it sideways (in units of the local width)."""
    c = catmull(ctrl, 12)
    w = [widths[min(len(widths) - 1, int(i * (len(widths) - 1) / max(1, len(c) - 1)))] for i in range(len(c))]
    # linear interpolation of the widths
    wi = []
    for i in range(len(c)):
        u = i * (len(widths) - 1) / max(1, len(c) - 1)
        a = int(u); b = min(len(widths) - 1, a + 1)
        wi.append(widths[a] + (widths[b] - widths[a]) * (u - a))
    left, right = [], []
    for i, (x, y) in enumerate(c):
        x0, y0 = c[max(0, i - 1)]; x1, y1 = c[min(len(c) - 1, i + 1)]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        cx, cy = x + nx * off * wi[i], y + ny * off * wi[i]
        left.append((cx + nx * wi[i] / 2, cy + ny * wi[i] / 2)); right.append((cx - nx * wi[i] / 2, cy - ny * wi[i] / 2))
    return mask_of(left + right[::-1])

def shift(m, dx, dy): return ImageChops.offset(m, dx, dy)

def paint(cv, m, base, rim=None, shade=None, d=8):
    cv.paste(base + (255,), mask=m)
    if rim: cv.paste(rim + (255,), mask=ImageChops.subtract(m, shift(m, d, d + 3)))
    if shade: cv.paste(shade + (255,), mask=ImageChops.subtract(m, shift(m, -d, -d - 3)))

def tri(a, b, c): return mask_of([a, b, c])

def rot(p, hinge, deg):
    a = math.radians(deg); x, y = p[0] - hinge[0], p[1] - hinge[1]
    return (hinge[0] + x * math.cos(a) - y * math.sin(a), hinge[1] + x * math.sin(a) + y * math.cos(a))

def rings(cv, ctrl, widths, n, color):
    """Dark ring lines across a horn, giving it segments."""
    c = catmull(ctrl, 12)
    for k in range(1, n + 1):
        i = int(k * (len(c) - 1) / (n + 1))
        x, y = c[i]; x0, y0 = c[max(0, i - 1)]; x1, y1 = c[min(len(c) - 1, i + 1)]
        L = math.hypot(x1 - x0, y1 - y0) or 1
        nx, ny = -(y1 - y0) / L, (x1 - x0) / L
        u = i * (len(widths) - 1) / (len(c) - 1); a = int(u); b = min(len(widths) - 1, a + 1)
        w = (widths[a] + (widths[b] - widths[a]) * (u - a)) / 2
        ImageDraw.Draw(cv).line([(x - nx * w, y - ny * w), (x + nx * w, y + ny * w)], fill=color + (255,), width=5)

def dragon(wing="up", jaw=0, bob=0, eye="open", glow=False):
    cv = Image.new("RGBA", SZ, (0, 0, 0, 0))
    hy = bob                                               # the head dips by bob (drawing px)
    # --- wing (behind everything) ---
    if wing == "up":  Wr, T = (640, 125), [(790, 35), (925, 160), (945, 335)]
    else:             Wr, T = (655, 235), [(835, 200), (925, 300), (895, 430)]
    Sh = (565, 360)
    sc = [((T[i][0] + T[i + 1][0]) / 2 - 22, (T[i][1] + T[i + 1][1]) / 2 + 28) for i in range(2)]
    sc3 = ((T[2][0] + 800) / 2 - 10, (T[2][1] + 410) / 2 + 10)
    memb = mask_of([Sh, Wr, T[0], sc[0], T[1], sc[1], T[2], sc3, (800, 410)])
    paint(cv, memb, WING, WING_L, WING_D, 10)
    for i in range(3):                                      # darker membrane between the finger bones
        gap = mask_of([Wr, T[i], ((T[i][0] + Wr[0]) / 2 + 10, (T[i][1] + Wr[1]) / 2 + 35)])
        cv.paste(WING_D + (255,), mask=ImageChops.multiply(gap, memb))
    paint(cv, ribbon([Sh, ((Sh[0] + Wr[0]) / 2 - 15, (Sh[1] + Wr[1]) / 2), Wr], [36, 28, 20]), BODY, RIM, SHADE, 6)
    for t in T: paint(cv, ribbon([Wr, ((Wr[0] + t[0]) / 2, (Wr[1] + t[1]) / 2 - 8), t], [20, 12, 4]), BODY, RIM, SHADE, 4)
    # --- tail ---
    paint(cv, ribbon([(790, 450), (870, 475), (925, 525), (940, 585), (905, 632)], [96, 70, 46, 26, 8]), BODY2, RIM2, SHADE2, 9)
    paint(cv, ribbon([(912, 612), (890, 640), (872, 668)], [26, 14, 3]), BONE, BONE_RIM, BONE_SH, 4)
    # --- far arm ---
    far = ribbon([(548, 462), (514, 530), (500, 590), (470, 628)], [56, 42, 32, 26])
    paint(cv, far, BODY2, RIM2, SHADE2, 6)
    for dx in (-18, -3, 12): paint(cv, tri((466 + dx, 626), (472 + dx, 626), (456 + dx * 1.2, 656)), BONE, BONE_RIM, None, 3)
    # --- torso, haunch, belly ---
    torso = blob([(430, 445), (475, 375), (560, 345), (665, 345), (765, 372), (822, 425), (815, 485), (742, 522), (640, 542), (540, 546), (470, 524)])
    paint(cv, torso, BODY, RIM, SHADE, 10)
    for x in range(500, 760, 26):                            # belly plates
        plate = ribbon([(x, 508), (x + 10, 530)], [26, 24])
        cv.paste(AMBER + (255,), mask=ImageChops.multiply(plate, torso))
        cv.paste(AMBER_D + (255,), mask=ImageChops.multiply(ribbon([(x + 22, 508), (x + 28, 532)], [5, 5]), torso))
    haunch = blob([(672, 470), (700, 400), (760, 392), (805, 440), (800, 510), (750, 548), (690, 530)])
    paint(cv, haunch, BODY, RIM, SHADE, 10)
    # --- hind leg and foot ---
    paint(cv, ribbon([(748, 505), (672, 572), (706, 630)], [92, 56, 40]), BODY, RIM, SHADE, 8)
    paint(cv, mask_of([(655, 640), (668, 620), (745, 618), (800, 630), (806, 650), (655, 652)]), BODY, RIM, SHADE, 6)
    for dx in (0, 22, 44): paint(cv, tri((660 + dx, 642), (676 + dx, 644), (644 + dx, 668)), BONE, BONE_RIM, None, 3)
    # --- neck (rises from the chest, bends forward and down to the head) ---
    neck_c = [(478, 455), (455, 372), (418, 312), (368, 276 + hy / 2), (312, 284 + hy)]
    neck_w = [124, 98, 78, 64, 58]
    neck = ribbon(neck_c, neck_w)
    paint(cv, neck, BODY, RIM, SHADE, 8)
    throat = ribbon(neck_c, [40, 30, 24, 18, 15], off=-0.3)
    cv.paste(AMBER + (255,), mask=ImageChops.multiply(throat, neck))
    for k in range(1, 7):                                    # throat plate lines
        c = catmull(neck_c, 12); i = int(k * len(c) / 8); x, y = c[i]
        ImageDraw.Draw(cv).line([(x - 24, y + 4), (x - 4, y + 16)], fill=AMBER_D + (255,), width=4)
    # --- near arm: plain, clawed ---
    paint(cv, ribbon([(478, 452), (436, 520), (428, 584), (388, 628)], [78, 58, 40, 32]), BODY, RIM, SHADE, 7)
    paint(cv, blob([(352, 626), (392, 612), (420, 630), (410, 652), (362, 654)]), BODY, RIM, SHADE, 5)
    for dx in (-20, -2, 16): paint(cv, tri((378 + dx, 628), (390 + dx, 630), (362 + dx * 1.3, 662)), BONE, BONE_RIM, None, 3)
    # --- back spines ---
    back = []
    tm = torso
    for x in range(486, 800, 38):
        for y in range(300, 560):
            if tm.getpixel((x, y)): back.append((x, y)); break
    for i, (x, y) in enumerate(back):
        hgt = 50 - i * 2
        paint(cv, tri((x - 15, y + 8), (x + 15, y + 8), (x + 20, y - hgt)), BODY, RIM, SHADE, 5)
    # --- head and horns (horns behind the skull) ---
    def H(p): return (p[0], p[1] + hy)
    horns = [([(255, 238), (292, 176), (352, 128), (424, 108)], [44, 32, 14, 2], BONE, 5),
             ([(280, 244), (330, 196), (392, 176), (446, 178)], [34, 24, 10, 2], BONE_SH, 4),
             ([(218, 226), (196, 184), (176, 142)], [24, 14, 2], BONE, 3),
             ([(250, 232), (262, 196), (258, 160)], [18, 10, 2], BONE_SH, 2)]
    for ctrl, w, col, nr in horns:
        c2 = [H(p) for p in ctrl]
        paint(cv, ribbon(c2, w), col, BONE_RIM if col == BONE else BONE, BONE_SH if col == BONE else (110, 96, 80), 4)
        rings(cv, c2, w, nr, BONE_SH if col == BONE else (90, 78, 66))
    for a, b, c in (((286, 318), (284, 340), (346, 352)), ((294, 332), (290, 356), (352, 392)), ((284, 300), (284, 318), (342, 308))):   # cheek spikes
        paint(cv, tri(H(a), H(b), H(c)), BONE, BONE_RIM, BONE_SH, 3)
    skull = blob([H(p) for p in [(290, 252), (255, 232), (212, 222), (168, 234), (118, 258), (66, 284), (38, 304), (44, 326), (80, 338), (130, 350), (190, 362), (246, 358), (288, 330), (302, 290)]])
    paint(cv, skull, BODY, RIM, SHADE, 8)
    paint(cv, tri(H((78, 292)), H((60, 296)), H((46, 262))), BONE, BONE_RIM, BONE_SH, 3)          # nose horn
    for x in (108, 146, 184):                                                                          # brow ridge spikes
        paint(cv, tri(H((x - 10, 250 - (x - 108) // 6)), H((x + 10, 244 - (x - 108) // 6)), H((x + 2, 222 - (x - 108) // 5))), BONE, None, BONE_SH, 3)
    for x in (82, 124, 168):                                                                          # upper fangs
        paint(cv, tri(H((x, 338)), H((x + 14, 342)), H((x + 7, 366 + (x - 82) // 20))), BONE, BONE_RIM, None, 2)
    # lower jaw, hinged behind the mouth
    hinge = (268, 342 + hy)
    jp = [(64, 340), (150, 358), (236, 366), (284, 340), (258, 384), (180, 398), (110, 384), (74, 360)]
    jp = [rot(H(p), hinge, jaw) for p in jp]
    jm = blob(jp)
    if glow:
        mouth = blob([H((60, 334)), H((130, 348)), H((250, 350)), rot(H((250, 372)), hinge, jaw), rot(H((110, 372)), hinge, jaw), rot(H((70, 346)), hinge, jaw)])
        paint(cv, mouth, (200, 60, 20))
        paint(cv, blob([H((90, 346)), H((170, 352)), rot(H((170, 366)), hinge, jaw), rot(H((100, 362)), hinge, jaw)]), (255, 214, 90))
    paint(cv, jm, BODY, RIM, SHADE, 7)
    for x in (92, 128):                                                                                # lower fangs
        t = tri(rot(H((x, 362)), hinge, jaw), rot(H((x + 12, 360)), hinge, jaw), rot(H((x + 5, 336)), hinge, jaw))
        paint(cv, t, BONE, BONE_RIM, None, 2)
    paint(cv, tri(rot(H((168, 388)), hinge, jaw), rot(H((190, 392)), hinge, jaw), rot(H((160, 420)), hinge, jaw)), BONE, BONE_RIM, BONE_SH, 3)   # chin spike
    # eye and scowl
    if eye == "open":
        e = mask_of(catmull([H((178, 262)), H((200, 252)), H((226, 262)), H((200, 274))], 8, closed=True))
        paint(cv, e, EMBER)
        cv.paste((255, 230, 120, 255), mask=mask_of([H((196, 256)), H((208, 258)), H((204, 266)), H((194, 264))]))
        cv.paste(SHADE + (255,), mask=ribbon([H((204, 253)), H((206, 272))], [7, 7]))
    else:
        cv.paste(SHADE + (255,), mask=ribbon([H((176, 264)), H((226, 266))], [8, 8]))
    paint(cv, ribbon([H((150, 232)), H((196, 244)), H((238, 270))], [10, 18, 12]), SHADE)
    return cv

# ---------- shrink to the pixel sprite ----------
PALETTE = [BODY, RIM, SHADE, BODY2, RIM2, SHADE2, BONE, BONE_RIM, BONE_SH, (110, 96, 80), (90, 78, 66), WING, WING_L, WING_D,
           AMBER, AMBER_D, EMBER, (255, 230, 120), (200, 60, 20), (255, 214, 90)]

def nearest(c): return min(PALETTE, key=lambda p: sum((p[i] - c[i]) ** 2 for i in range(3)))

def to_cells(cv):
    """Shrink, cut the edge at half coverage, and snap every pixel to the drawing's own palette (so amber stays amber)."""
    small = cv.resize((SZ[0] // S, SZ[1] // S), Image.BOX)
    W, H = small.size
    return [[(nearest(small.getpixel((x, y))[:3]) if small.getpixel((x, y))[3] >= 128 else None) for x in range(W)] for y in range(H)]

def bbox(frames):
    xs = [x for c in frames for r in c for x, v in enumerate(r) if v is not None]
    ys = [y for c in frames for y, r in enumerate(c) if any(v is not None for v in r)]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1

def crop(c, b): return [r[b[0]:b[2]] for r in c[b[1]:b[3]]]

OUT = (120, 140, 180)                                     # a pale rim: a black body would vanish on the dark forest
def outline(c, pad=2):
    W = len(c[0]); H = len(c)
    c = [[None] * (W + 2 * pad) for _ in range(pad)] + [[None] * pad + r + [None] * pad for r in c] + [[None] * (W + 2 * pad) for _ in range(pad)]
    HH, WW = len(c), len(c[0])
    edge = [(x, y) for y in range(HH) for x in range(WW) if c[y][x] is None and any(
        0 <= y + dy < HH and 0 <= x + dx < WW and c[y + dy][x + dx] is not None for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge: c[y][x] = OUT
    return c

def lerp(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
def mapc(c, fn): return [[fn(v) if v is not None else None for v in r] for r in c]

def with_z(c, f):
    c = [r[:] for r in c]
    for dy, row in enumerate(["ZZZZ", "..Z.", ".Z..", "ZZZZ"]):
        for dx, ch in enumerate(row):
            if ch == "Z" and 0 <= 3 + f * 4 + dy < len(c): c[3 + f * 4 + dy][2 + dx] = (207, 216, 255)
    return c

if __name__ == "__main__":
    big = {"idle": dragon("up"), "idle-1": dragon("down", bob=10), "attack": dragon("up", jaw=24, glow=True), "sleep": dragon("down", eye="shut", bob=18)}
    if len(sys.argv) > 3:
        sheet = Image.new("RGBA", (SZ[0] * 2, SZ[1] * 2), (16, 30, 60, 255))
        for i, k in enumerate(big): sheet.alpha_composite(big[k], ((i % 2) * SZ[0], (i // 2) * SZ[1]))
        sheet.save(sys.argv[3])
    raw = {k: to_cells(v) for k, v in big.items()}
    box = bbox(raw.values())
    cells = {k: outline(crop(v, box)) for k, v in raw.items()}
    print("mouth at art px", round((60 / S - box[0] + 2) * 1, 1), round((345 / S - box[1] + 2), 1))
    idle = cells["idle"]
    pink = mapc(cells["idle-1"], lambda v: v if v == OUT else (255, 154, 168))
    frames = {"dragon-idle": idle, "dragon-idle-1": cells["idle-1"], "dragon-attack": cells["attack"], "dragon-hit": pink,
              "dragon-sleep": with_z(mapc(cells["sleep"], lambda v: v if v == OUT else lerp(v, (6, 6, 16), 0.35)), 0),
              "dragon-sleep-1": with_z(mapc(cells["sleep"], lambda v: v if v == OUT else lerp(v, (6, 6, 16), 0.35)), 1),
              "dragon-sleep-2": with_z(mapc(cells["sleep"], lambda v: v if v == OUT else lerp(v, (6, 6, 16), 0.35)), 2)}
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    colours = []
    for c in frames.values():
        for r in c:
            for v in r:
                if v is not None and v not in colours: colours.append(v)
    assert len(colours) <= len(letters), len(colours)
    code = {v: letters[i] for i, v in enumerate(colours)}
    print(f"{len(idle[0])}x{len(idle)}, {len(colours)} colours")
    json.dump({"palette": {letters[i]: "#%02x%02x%02x" % v for i, v in enumerate(colours)},
               "avatars": {n: ["".join(code[v] if v is not None else "." for v in r) for r in c] for n, c in frames.items()}},
              open(sys.argv[1], "w"), indent=2)
