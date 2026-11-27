# Writes docs/gifs/: one GIF per witch move and sleep loop, from the card frames, at the mod's speeds. Run from the repo root.
import glob
from PIL import Image
BG = (5, 4, 8, 255)  # kage background
def gif(out, pattern, ms):
    files = sorted(glob.glob(pattern), key=lambda f: int(f.rsplit('-', 1)[1][:-4]))
    assert files, pattern
    frames = []
    for f in files:
        im = Image.open(f).convert('RGBA')
        bg = Image.new('RGBA', im.size, BG); bg.alpha_composite(im)
        frames.append(bg.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST))
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=ms, loop=0, disposal=1)
    print(out, len(files))
# One entry per pet in main.js PETS: (id, its ms per sleep frame).
for pet, sleep_ms in [('witch-black', 750), ('witch', 250), ('witch-fire', 400)]:
    for src in ['atk', 'strike', 'fireball', 'circle', 'lightning', 'hand', 'twirl', 'done', 'plead']:
        gif(f'docs/gifs/{pet}-{"cast" if src == "atk" else src}.gif', f'mods/kage-agents/{pet}-{src}-[0-9]*.png', 125)
    gif(f'docs/gifs/{pet}-sleep.gif', f'avatars/{pet}-sleep-[0-9]*.png', sleep_ms)
