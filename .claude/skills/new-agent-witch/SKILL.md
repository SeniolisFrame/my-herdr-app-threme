---
name: new-agent-witch
description: Make a new character (or restyle one) for the kage-agents witch cards with Pixellab - its look, its 7 working moves and its sleep loop - and wire it into avatars/witch_attack.py and mods/kage-agents/main.js. Use when asked for a new witch/mage/character/avatar on the agent cards, a new move, or a fix to one character's frames.
---

# A new character for the agent cards

The cards show one character per agent: 9 frames of a move while the agent works, a sleep loop while it idles.
Art is Pixellab frames in `avatars/pixellab/`, turned into 96px card art by `python avatars/witch_attack.py`.
Existing pets: `witch` (blue, source `witch_front`) and `witch-black` (source `witch_black`).

## Ground rules (learned the hard way)

- **Copyright:** design original characters. Never upload another company's or artist's art to Pixellab as a reference,
  and never put a lookalike of a game character (Eve, Elesis, ...) into the repo. Asset packs whose license says
  "no modification / no uploading" (e.g. BLZ cursors) are off limits.
- **Credits:** run `get_balance` first and tell the user the cost before spending. The trial plan runs one job at a time
  (submit, `wait_for_jobs`, then the next). `inpaint_image` and `edit_animation` need a paid plan; don't plan on them.
- **Don't regenerate a whole character to fix one detail.** Fix small things by hand with PIL (free), or edit one
  frame with `edit_image_pixen` (1 generation).

## Recipe: restyle an existing character (cheapest, ~9 generations)

Start from a standing frame the user already likes (e.g. `avatars/pixellab/witch_front_attack_0.png`, 132x132).

1. **Look** - `edit_image_pixen` on the standing frame (1 gen, prompt max 500 chars). Say what changes AND what stays:
   "... Keep her face, hair and pose." Show the user a side-by-side before going on; iterate here, it's cheap.
   Save the result as `avatars/pixellab/<src>_stand.png`.
2. **Upload it** - `get_upload_url`, then `curl -F "file=@<png>" <url>`; use the returned `upload:<id>`.
3. **Cast** - `animate_image_pixminimax(first_frame_url=upload, last_frame_url=upload, frame_count=8, direction="south",
   subject_description=...)` (1 gen). Same first and last frame makes it loop. `get_image` returns 9 images:
   index 0 is the input, 1-8 the motion. Download `?index=0..8` to `<src>_attack_0..8.png`.
4. **The six other moves** - same call, 1 gen each, files `<src>_<move>_0..8.png` for
   `strike, fireball, circle, lightning, hand, twirl`. Motion prompts that worked (swap the magic colour per character):
   - strike: lifts the staff high and swings it down in front of her, a burst of <colour> sparks where it strikes, cloak flares
   - fireball: points the staff forward, a <colour> bolt forms at its tip and shoots away, the staff recoils
   - circle: plants the staff, a glowing <colour> magic circle spreads on the ground around her feet, cloak and hair lift
   - lightning: raises the staff to the sky, a <colour> lightning bolt strikes the tip and crackles around her
   - hand: free hand forward palm up, a small <colour> orb appears, swirls, pulses, fades
   - twirl: twirls the staff in a full circle beside her, a trail of <colour> sparkles follows the tip
   Each ends "...then she returns to the starting pose".
5. **Sleep** - one call from the standing (or sitting) frame, 4-8 frames, describing dozing. Pick the frames with eyes shut.
   If the head barely moves, exaggerate the nod by hand (move the head box down 0-3px per frame, see `witch_front_nod_*`).

## Recipe: a brand-new character

`create_character` mode `v3`, size 96 (3 gens) or 132 (4 gens), then continue from step 2 with its south rotation.
Prompt lessons: words like *mecha, armored, boots, coat panels* give bulky legs; ask for "slim, light build, no armor
on legs". "chibi"/"big head" is ignored by v3 - say "head about one quarter of her height" for card-friendly
proportions. A thin katana at 96px needs "single-edged, narrow, gentle curve, not a broadsword". Generate one, show it,
then decide - don't animate a look the user hasn't approved.

## Wire it in

- `avatars/witch_attack.py`: add `("<pet-id>", "<src>", [<sleep source names>])` to the `for id, src, sleeps in [...]`
  list. Every pet needs all of `MOVES` (there is no fallback image).
- `mods/kage-agents/main.js`: add `{ id: "<pet-id>", label: "...", sleep: <n frames>, ms: <ms per sleep frame> }` to `PETS`.
- `python avatars/witch_attack.py`, then check a contact sheet of `mods/kage-agents/<pet-id>-*-0..8.png` (all 96x96, same
  size in every move), `node --input-type=module --check < mods/kage-agents/main.js`, and `README.md` (Witch cards).
- `.\install.ps1` (PowerShell, herdr-app running), then the user restarts herdr-app. Pick it under Avatar in the sort
  menu or by right-clicking a card.

## Known fixes

- **Ring/effect off-centre:** Pixellab often draws ground effects off to one side and clipped by the canvas. Keep the
  character still; take the effect pixels (its hue, plus the white-hot core, that differ from the standing frame, rows
  below the feet), keep the half left of the boots' centre and mirror it. Measure the boots from the bottom rows right of
  the staff, not the whole bottom row (staff and cloak skew it). Skip frames with under ~30 effect pixels.
- **Effects past the card:** moves keep the cast's scale and place, so big effects get cut at the 96px edge. That's
  intended - the character stays the same size in every move.
- Note any hand-edited source in the header of `witch_attack.py` so a re-download doesn't silently undo it.
- Status moves: every pet also needs `done` (cheer: hand up, a jump) and `plead` (hands clasped, begging face) - the DONE and
  NEEDS YOU cards play them (`STATUS_MOVE` in main.js); they are in `MOVES` in witch_attack.py but not in the menu.
- Commits: no Co-Authored-By trailer (user preference).
