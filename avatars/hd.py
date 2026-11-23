# Helpers for the detailed sprites (the classes): draw big with smooth curves, shade the edges, shrink to pixels.
# A figure is drawn on a SZ canvas (10 drawing px per art px), every part painted as a base colour with a lit top-left rim and a
# dark bottom-right shade, then shrunk, snapped to the figure's own palette and outlined.
import json, math
from PIL import Image, ImageChops, ImageDraw

S = 10

def catmull(pts, n=10, closed=False):
    P = list(pts)
    P = ([P[-1]] + P + [P[0], P[1]]) if closed else ([P[0]] + P + [P[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t * t
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t ** 3) for j in range(2)))
    if not closed: out.append(P[-2])
    return out

class Canvas:
    def __init__(self, size):
        self.size = size
        self.img = Image.new("RGBA", size, (0, 0, 0, 0))
        self.colors = []                                     # every colour painted, for the sprite's palette

    def mask(self, pts):
        m = Image.new("L", self.size, 0)
        ImageDraw.Draw(m).polygon(pts, fill=255)
        return m

    def blob(self, pts): return self.mask(catmull(pts, 10, closed=True))

    def ellipse(self, cx, cy, rx, ry):
        m = Image.new("L", self.size, 0)
        ImageDraw.Draw(m).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
        return m

    def ribbon(self, ctrl, widths, off=0.0):
        c = catmull(ctrl, 12)
        left, right = [], []
        for i, (x, y) in enumerate(c):
            u = i * (len(widths) - 1) / max(1, len(c) - 1)
            a = int(u); b = min(len(widths) - 1, a + 1)
            w = widths[a] + (widths[b] - widths[a]) * (u - a)
            x0, y0 = c[max(0, i - 1)]; x1, y1 = c[min(len(c) - 1, i + 1)]
            L = math.hypot(x1 - x0, y1 - y0) or 1
            nx, ny = -(y1 - y0) / L, (x1 - x0) / L
            cx, cy = x + nx * off * w, y + ny * off * w
            left.append((cx + nx * w / 2, cy + ny * w / 2)); right.append((cx - nx * w / 2, cy - ny * w / 2))
        return self.mask(left + right[::-1])

    def tri(self, a, b, c): return self.mask([a, b, c])

    @staticmethod
    def shift(m, dx, dy): return ImageChops.offset(m, dx, dy)

    def paint(self, m, base, rim=None, shade=None, d=8, clip=None):
        self.colors += [x for x in (base, rim, shade) if x and x not in self.colors]
        if clip is not None: m = ImageChops.multiply(m, clip)
        self.img.paste(base + (255,), mask=m)
        if rim: self.img.paste(rim + (255,), mask=ImageChops.subtract(m, self.shift(m, d, d + 3)))
        if shade: self.img.paste(shade + (255,), mask=ImageChops.subtract(m, self.shift(m, -d, -d - 3)))
        return m

    def line(self, pts, color, width):
        if color not in self.colors: self.colors.append(color)
        ImageDraw.Draw(self.img).line(pts, fill=color + (255,), width=width)

# ---------- shrink to the pixel sprite ----------
def to_cells(img, palette):
    small = img.resize((img.size[0] // S, img.size[1] // S), Image.BOX)
    near = lambda c: min(palette, key=lambda p: sum((p[i] - c[i]) ** 2 for i in range(3)))
    W, H = small.size
    return [[(near(small.getpixel((x, y))[:3]) if small.getpixel((x, y))[3] >= 128 else None) for x in range(W)] for y in range(H)]

def bbox(frames):
    xs = [x for c in frames for r in c for x, v in enumerate(r) if v is not None]
    ys = [y for c in frames for y, r in enumerate(c) if any(v is not None for v in r)]
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1

def outline(c, color, pad=1):
    W = len(c[0]); H = len(c)
    c = [[None] * (W + 2 * pad) for _ in range(pad)] + [[None] * pad + r + [None] * pad for r in c] + [[None] * (W + 2 * pad) for _ in range(pad)]
    HH, WW = len(c), len(c[0])
    edge = [(x, y) for y in range(HH) for x in range(WW) if c[y][x] is None and any(
        0 <= y + dy < HH and 0 <= x + dx < WW and c[y + dy][x + dx] is not None for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge: c[y][x] = color
    return c

def write_json(frames, path):
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    colours = []
    for c in frames.values():
        for r in c:
            for v in r:
                if v is not None and v not in colours: colours.append(v)
    assert len(colours) <= len(letters), len(colours)
    code = {v: letters[i] for i, v in enumerate(colours)}
    json.dump({"palette": {letters[i]: "#%02x%02x%02x" % v for i, v in enumerate(colours)},
               "avatars": {n: ["".join(code[v] if v is not None else "." for v in r) for r in c] for n, c in frames.items()}},
              open(path, "w"), indent=2)
    return len(colours)

def z_marks(c, f, color=(207, 216, 255)):
    c = [r[:] for r in c]
    for dy, row in enumerate(["ZZZZ", "..Z.", ".Z..", "ZZZZ"]):
        for dx, ch in enumerate(row):
            if ch == "Z" and 0 <= 2 + f * 4 + dy < len(c): c[2 + f * 4 + dy][1 + dx] = color
    return c
