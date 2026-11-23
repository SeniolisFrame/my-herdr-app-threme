# Dungeon strip in the tab bar: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working agents appear as pixel class-characters in the tab bar and attack a dragon boss in a dungeon scene.

**Architecture:** Class art goes through the existing pipeline (python grid -> json -> `avatars/build.mjs` -> SVG, copied into `mods/kage-agents/`). A new scene is drawn inside `kage-tabs` and reads agent status from `panes()`/tab status. The per-agent class lives in herdr `shared("agents.classes")` (written by `kage-agents`, read by `kage-tabs`), random-by-hash when unset.

**Tech Stack:** herdr mod JS (`gpui-kit`, `herdr`), Python 3 (art), Node (build.mjs), PowerShell (install).

**Spec:** `docs/superpowers/specs/2026-11-23-dragon-dungeon-tab-design.md`

## Global Constraints
- Sprites: 32x32 grids, drawn at 1 art-pixel = 1 device px (32px) in the bar; dragon grid <= 40x40. Bar is `size.px` 42 in the layout; raise to 48 in `kage-layout.ps1` only if the dragon is cramped.
- Classes (ids): `swordsman` (M), `rogue` (M), `priest` (F), `reaper` (F), `witch` (existing, mage). Bat removed.
- Per-agent class: random stable default (hash of pane id), user override stored in `shared("agents.classes")`, override wins.
- Frame timer only runs while an agent is working; sleeping dragon when none.
- Font stays Unifont; no HP/XP/state beyond the above.
- No `Co-Authored-By` trailer in commits (user's saved preference).

## Review Focus
- Zero working agents: dragon asleep, no characters, no timer ticking.
- More than 4 working agents: show 4 + a "+N" label; scene never overflows the tab list.
- Narrow window: scene shrinks/hides before tabs lose their names.
- Saved class id no longer exists (old `agents.pet` "bat", or garbage): fall back to the hash default.
- Pane closed: its stored class entry doesn't break rendering.
- Two agents with the same class: both render, animation offset differs.

---

### Task 1: Spike: can the tabs mod import a sibling file and run a timer?

**Files:** Create `mods/kage-tabs/dungeon.js` (stub), Modify `mods/kage-tabs/main.js`.

**Interfaces:** Produces: `export function scene(t, agents, now): Element` stub in `dungeon.js`; if relative import fails, inline it in `main.js` and note it in the plan.

- [ ] **Step 1:** Add `import { scene } from "./dungeon.js"` to `kage-tabs/main.js`, with `scene` returning `div().w(100).h(32).bg("#400")`; render it between the tab scroller and the `+` button.
- [ ] **Step 2:** Run `.\install.ps1`, restart herdr-app, confirm a red box shows. If not, move the code inline and stop using the separate file.
- [ ] **Step 3:** In `init(cx)` add `cx.timer.every(200, cx => { if (this.working) cx.notify(); })` (same pattern as `kage-agents/main.js:106`) and confirm it's only notifying when set.
- [ ] **Step 4:** Commit `spike: dungeon scene hook in kage-tabs`.

### Task 2: Dragon art and dungeon scene with the witch

**Files:** Create `avatars/dragon.py`, `avatars/dragon.json` (generated); Modify `avatars/build.mjs` (add `"dragon.json"` to the file list), `mods/kage-tabs/dungeon.js`, `mods/kage-tabs/main.js`.

**Interfaces:**
- Produces: SVGs `dragon-idle`, `dragon-attack`, `dragon-hit`, `dragon-sleep`, `dragon-sleep-1` (+ `-2`) in `avatars/`.
- Produces: `scene(t, party: {id: string, cls: string}[], now: number): Element` in `dungeon.js`; `party` = working agents, `now` = `Date.now()`.

- [ ] **Step 1:** `avatars/dragon.py` modelled on `witch.py` (square grid <= 40, palette dict, `assert {c for r in g for c in r} <= set(pal) | {"."}`), writes `dragon.json`. Run `python avatars/dragon.py avatars/dragon.json; node avatars/build.mjs`: expect no assertion error and the SVG names printed.
- [ ] **Step 2:** Check the art with `avatars/preview.ps1` (extend it to include the dragon); eyeball it is a dragon, readable at 40px.
- [ ] **Step 3:** In `dungeon.js` implement `scene`: dark brick background, two torches (flicker by `now`), floor line; dragon at right (`dragon-attack` on the beat when a hit lands, `dragon-hit` for 120 ms after each hit, `dragon-sleep*` when `party` is empty); characters left, each swinging `["awake","awake-mid","awake-down","awake-mid"][(Math.floor(now/250) + index) % 4]` of `mods/kage-agents/<cls>-<frame>.svg`; show first 4, then a `+N` label. Characters are 32px, stay inside the tab bar height.
- [ ] **Step 4:** `main.js`: build `party` from tabs with `status === "working"` (lead pane id from `panes()`), `cls` = `"witch"` for now; set `this.working = party.length > 0`. Hide the scene when `shared("dungeon.off")` is true.
- [ ] **Step 5:** Verify by hand: install, restart, start a Claude agent working -> witch hits dragon; idle -> dragon sleeps, no timer redraws; open 6 agents -> 4 + "+N"; shrink window -> tabs still readable.
- [ ] **Step 6:** Commit `Dragon boss and dungeon scene in the tab bar`.

### Task 3: Four new class sprites

**Files:** Create `avatars/classes.py`, `avatars/classes.json` (generated); Modify `avatars/build.mjs` (add `"classes.json"`).

**Interfaces:** Produces for each of `swordsman`, `rogue`, `priest`, `reaper`: `<id>-awake`, `-awake-mid`, `-awake-down` (swing/cast frames) and `<id>-sleep`, `-sleep-1`, `-sleep-2` (cards), all 32x32, same file names as the witch so `kage-agents` and the scene load them the same way.

- [ ] **Step 1:** `classes.py` with one `figure(asleep, f)` function per class (swordsman: sword; rogue: dagger, hood; priest: staff with cross/halo, F; reaper: scythe, F), plus the same `rim` outline and asserts as `witch.py` (palette letters unique ignoring case; every cell in the palette).
- [ ] **Step 2:** Run `python avatars/classes.py avatars/classes.json; node avatars/build.mjs`: expect 24 SVG names and no assertion error.
- [ ] **Step 3:** Preview all five classes side by side with `preview.ps1`; check each is distinct at 32px (silhouette) and each class has 3 awake frames that differ.
- [ ] **Step 4:** Commit `Swordsman, rogue, priest and reaper sprites`.

### Task 4: Per-agent class (random, changeable) on cards and in the scene

**Files:** Create `mods/kage-agents/classes.js` (if sibling imports worked in Task 1, else inline in both mods); Modify `mods/kage-agents/main.js` (replace `PETS`/`petOf`, lines ~67-69, 184-185, 383), `mods/kage-tabs/main.js`.

**Interfaces:**
- Produces: `CLASSES = ["swordsman","rogue","priest","reaper","witch"]` with labels; `classFor(id: string, chosen: Record<string,string> | undefined): string` returns `chosen[id]` if it is in `CLASSES`, else `CLASSES[hash(id) % CLASSES.length]`; `hash` is a deterministic string hash.
- Consumes: `shared("agents.classes")`, `setShared("agents.classes", map)`.

- [ ] **Step 1:** Test (node, plain `assert` in `mods/kage-agents/classes.test.mjs`): `classFor("a", {})` stable across calls; `classFor("a", {a:"rogue"}) === "rogue"`; `classFor("a", {a:"bat"})` equals `classFor("a", {})`; `classFor("a", undefined)` doesn't throw. Run `node mods/kage-agents/classes.test.mjs`: FAIL (not defined).
- [ ] **Step 2:** Implement `classes.js`. Run the test: PASS.
- [ ] **Step 3:** Cards: use `classFor(agent.id, shared("agents.classes"))` instead of `petOf()`; clicking the card avatar opens a small popup/menu of `CLASSES` (reuse the sort popup's `row` helper) and calls `setShared("agents.classes", {...current, [id]: choice})`. Remove the bat from `PETS`; replace the pet rows in the Agents menu with a "Dungeon scene" on/off row writing `shared("dungeon.off")`.
- [ ] **Step 4:** Tabs scene: `cls = classFor(paneId, shared("agents.classes"))`.
- [ ] **Step 5:** Remove bat art: delete `avatars/bat-*.svg`, the bat entries in `avatars/avatars.json`/`draw.py` as they're no longer used (check `build.mjs` still runs). `grep -ri bat` shows no references left.
- [ ] **Step 6:** Verify by hand: a new agent gets a class; clicking changes it on card and in the scene; restart herdr -> choice persists; a closed pane's old entry doesn't error.
- [ ] **Step 7:** Commit `Random agent classes, changeable from the card`.

### Task 5: Install, uninstall, docs, layout height

**Files:** Modify `install.ps1` (copy new `avatars/*.svg` already covered by the glob; update the "bat" comments), `uninstall.ps1`, `README.md`, `kage-layout.ps1` + `kage-layout.test.ps1` only if the bar height is raised.

- [ ] **Step 1:** Update install/uninstall comments and README (dungeon strip, five classes, how to change class, how to turn the scene off).
- [ ] **Step 2:** If the dragon was cramped at 42px, set the tabs block `size.px` to 48 in `kage-layout.ps1` and extend `kage-layout.test.ps1` to assert it; run `.\kage-layout.test.ps1`: PASS. Otherwise skip.
- [ ] **Step 3:** `.\install.ps1` then `.\uninstall.ps1` on a clean state: both exit 0, no bat/class files left behind after uninstall.
- [ ] **Step 4:** Commit `Document and install the dungeon strip`.
