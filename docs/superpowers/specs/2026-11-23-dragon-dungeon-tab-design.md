# Dungeon strip in the tab bar: working agents raid a dragon

## Intent
Make "agents are working" visible and fun: in the top tab bar, every agent whose status is `working` appears as a
pixel class-character in a dungeon and attacks a dragon boss. Idle/blocked/done agents are not in the fight.

## Goals
- Each working agent = one character (left), all hitting one dragon (right), in free space of the tab bar.
- Classes: swordsman (M), rogue (M), priest (F), scythe reaper (F), mage = existing witch. Bat is removed.
- Same class art on the Agents cards and in the strip (one art set).
- Dungeon look: dark brick wall strip, torches, stone floor. 8-bit, Unifont/pixel style like the rest of kage.
- No working agent: dragon sleeps (zzz), no characters. Dragon hit-flashes when struck.

## Non-goals
- No game state: no HP, XP, levels, loot, persistence.
- No input from the strip (not clickable, except maybe tooltip later).

## Constraints (found in code)
- Bar height is set by the layout file, not the mod: `layouts/<name>.json` tabs block `size.px`, currently 42.
  Tab chips are 29px tall inside it, so ~41px are free vertically (1px border).
- `kage-layout.ps1` rewrites layouts by regex; any layout change (height) goes there so it survives reinstall.
- Art pipeline exists: `avatars/*.py` grid -> json -> `build.mjs` -> SVG (32x32 grids, crisp).
- Data: `panes()` (program.agent, tab), tab `status === "working"`.

## Approaches
1. Tiny new 12x12 sprites at 2x in the current bar. Cheap, but a second art set.
2. (Picked) Reuse the 32x32 class art 1:1 in the bar, add a dragon grid (<=40x40) and dungeon background.
   Bar needs ~42px, which the layout already has, so likely no layout change; raise to ~48px only if the dragon looks cramped.
Picked 2 by the user. Strip draws 32px sprites at 1 art-pixel = 1 device pixel; the cards draw the same SVGs bigger.

## Decisions
- Class per agent: random by default (stable hash of pane id over the five classes), and the user can change it per agent (their request).
  Change = click the avatar on the agent's card to open a small class picker (my call on the UI); the choice is stored per agent in localStorage and wins over the random default. The old global avatar picker in the Agents menu becomes a scene on/off toggle.
- Attack animation: reuse the three awake frames (awake / mid / down) as swing frames, offset per agent so they don't hit in sync.
- Layout of the strip: [tabs ........ | dungeon scene: party -> dragon | + Files Changes window buttons]. Scene sits in the free space, tabs keep priority and shrink the scene when crowded (up to ~4 characters shown, "+N" beyond).
- Art is drawn by new `avatars/<class>.py` scripts following `witch.py`; sleep frames kept for cards.
- Frame ticking via a timer re-render (~200ms), only while at least one agent is working.

## Left to the builder
Exact palettes, dragon design, torch flicker, hit-flash timing, whether the scene clips or hides on narrow windows.

## Rough order
1. Dragon + dungeon strip with the existing witch only (proves layout, animation, performance).
2. Four new classes (art), class assignment, replace bat in `PETS`.
3. Card avatars show the class; install/uninstall/README updated.
