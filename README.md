# my-herdr-app-threme

Themes for [herdr-app](https://herdr.dev). Separate from
[my-herdr-app](https://github.com/SeniolisFrame/my-herdr-app) (the Files and Changes
panels): a theme works with any layout.

## kage (影, shadow)

A near-black theme: the background, sidebars and cards are black with a trace of violet;
violet only marks what is picked, the borders and the accent; crimson for the main buttons,
a red cursor. Every text color keeps at least 4.5:1 contrast on the backgrounds it sits on.

## More colors

Same layout, other colors: `.\install.ps1 -Theme <name>`, back with `.\install.ps1`. The theme files are `kage-<name>.json`, so they cannot clash with one of your own.

| name | looks |
|---|---|
| midnight | navy with gold buttons |
| sakura | black-plum with pink |
| forest | deep green with emerald, amber buttons |
| ember | warm brown-black with orange |
| ocean | deep teal with cyan, amber buttons |

Text colors keep at least 4.5:1 contrast on the backgrounds.

Pick the avatar in the Agents list, not in the theme: its top-right button (the sort one) opens a menu with
Sort agents and Avatar, Bat or Witch, and either works with either theme. The witch is a cute girl with long pink hair
(staff orb pulsing and sparks while the agent works, dozing under her hat with z's while it idles), drawn by `avatars/witch.py`.
Herdr's Settings has no place for mods, hence the menu.

![witch](avatars/witch-preview.png)

## Bat cards (mods/kage-agents)

A copy of herdr's Agents list where each agent is a card with an 8-bit bat: wings spread, red
eyes, one glowing with a flare, and a violet aura, flapping, while the agent works or needs you;
hanging upside down from a branch, wings wrapped round, with z's rising while it idles. Each card is named
after its terminal's folder, like the tabs, with its space's name underneath in that
space's color. `programs.json` draws the Claude icon in violet instead of orange (install writes
it only if you have none). It also paints the
space tiles in kage hues (violet, crimson, indigo, plum, dusk, wine) in place of the stock
teal/orange/blue.

![bats](avatars/preview.png)

`python avatars/draw.py avatars/avatars.json` draws the two 32x32 pixel grids, `node avatars/build.mjs`
turns them into the SVGs (shown at 64px, 2x).

## 8-bit spaces (mods/kage-spaces)

A copy of herdr's Spaces list in a VGA pixel font at its native 16px: no letter tiles, each
space's name in its own color (lightened to read on black, at least 5.9:1), a colored bar on
the open one, no repo, branch or ahead/behind counts. The font is [PxPlus IBM VGA 8x16](https://int10h.org/oldschool-pc-fonts/) by VileR,
CC BY-SA 4.0 (`mods/kage-spaces/fonts/LICENSE-PxPlus.txt`). The agent cards' text is in
Pixelated MS Sans Serif by lou, CC BY-SA 3.0 (`LICENSE-MSSansSerif.txt` there). Herdr ships both.

## 8-bit tab bar (mods/kage-tabs)

Herdr's tab bar in the same pixel font: each tab named after its terminal's folder (a name you
gave a tab stays), no program icons, the open tab in the open space's name color with a line
under it.

## 8-bit pane frames (mods/kage-pane)

Each terminal pane (PowerShell, Claude Code, ...) gets square corners and a 2px border, violet
while it has the keyboard, and a header in the same pixel font: program, title, folder,
the agent's status, and split/zoom/close buttons on hover.

## Install

Windows: `.\install.ps1` (with herdr-app running). It copies the theme and the mod, switches to kage, and points
your current layout at the kage mods, with square 2px pane frames. Herdr's own layouts (main, terminals,
win98) are read-only: clone one first (`herdr-app do layout.clone`), then run it again.
It also leaves `kage-layout.ps1` in herdr-app's `after-layout` folder: an installer that
rewrites a layout (my-herdr-app's does) runs it afterwards, so kage stays without a second install. `.\kage-layout.test.ps1`
checks it on a copy of herdr's main layout.

macOS / Linux:

```sh
APP="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
mkdir -p "$APP/themes" "$APP/mods/kage-agents"
cp themes/*.json "$APP/themes/" && cp mods/kage-agents/* avatars/*.svg "$APP/mods/kage-agents/"
cp -r mods/kage-spaces mods/kage-tabs mods/kage-pane "$APP/mods/"
herdr-app do app.theme --name kage
```

then set `"mod": "agents"` to `"kage-agents"` `"spaces"` to `"kage-spaces"` and `"tabs"` to `"kage-tabs"` in your layout (`$APP/layouts/<name>.json`); for the pane frames,
`"pane"` to `"kage-pane"`, the pane frame's `radius` to 0 and its border and focus `width` to 2.

## Uninstall

Windows: `.\uninstall.ps1` with herdr-app running puts herdr's Agents and Spaces lists,
tab bar and pane frames (rounded 10, 1px) back in your layouts, switches to graphite and removes the kage theme, mods and its `after-layout` script. Herdr keeps the space tile
colors in memory, so to reset them close herdr-app and run `.\uninstall.ps1` once more.

Elsewhere: `herdr-app do app.theme --name graphite`, set `"kage-agents"`/`"kage-spaces"`/`"kage-tabs"`/`"kage-pane"`
back to `"agents"`/`"spaces"`/`"tabs"`/`"pane"` in your layout (pane frame `radius` 10, widths 1), delete the `$APP/mods/kage-*` folders; with herdr closed, delete
`space.colors` from `$APP/shared.json`.
