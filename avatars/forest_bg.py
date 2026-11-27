# Builds mods/kage-agents/forest-bg.png from avatars/pixellab/forest.png: a blue-black night
# (the purple sky and its glow go blue by brightness), widened with mirrored edges, one moon, x2.
from PIL import Image, ImageOps
a = Image.open('avatars/pixellab/forest.png').convert('RGB'); w, h = a.size
tone = {(5,3,24):(4,9,22), (7,3,34):(6,13,31), (10,7,30):(8,15,30), (23,23,110):(11,25,62), (24,22,99):(10,23,56), (22,21,87):(9,21,50)}
ground = {(5,3,24):(9,19,40), (7,3,34):(12,24,50)}
lum = lambda c: .3*c[0] + .59*c[1] + .11*c[2]
sky = set(c for _, c in a.getcolors(1 << 16) if c not in tone and min(c) < 200)  # not the stars and moon
lo, hi = min(map(lum, sky)), max(map(lum, sky))
dark, light = (8, 14, 34), (62, 104, 172)
blue = lambda c: tuple(round(d + (l - d) * (lum(c) - lo) / (hi - lo)) for d, l in zip(dark, light))
for y in range(h):
    for x in range(w):
        c = a.getpixel((x, y)); n = (ground if y >= 83 else {}).get(c) or tone.get(c) or (blue(c) if c in sky else None)
        if n: a.putpixel((x, y), n)
L, R = a.crop((0, 0, 160, h)), a.crop((240, 0, 400, h))
s = Image.new('RGB', (1040, h)); x = 0
for p in (L, ImageOps.mirror(L), a, ImageOps.mirror(R), R): s.paste(p, (x, 0)); x += p.size[0]
s.resize((2080, 200), Image.NEAREST).save('mods/kage-agents/forest-bg.png', optimize=True)
