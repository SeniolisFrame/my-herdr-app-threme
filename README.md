# my-herdr-app-threme

Themes for [herdr-app](https://herdr.dev). Separate from
[my-herdr-app](https://github.com/SeniolisFrame/my-herdr-app) (the Files and Changes
panels): a theme works with any layout.

## kage (影, shadow)

A near-black theme: the background, sidebars and cards are black with a trace of violet;
violet only marks what is picked, the borders and the accent; crimson for the main buttons,
a red cursor. Every text color keeps at least 4.5:1 contrast on the backgrounds it sits on.

## Install

Windows:

```powershell
.\install.ps1
```

macOS / Linux:

```sh
APP="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
mkdir -p "$APP/themes" && cp themes/*.json "$APP/themes/"
herdr-app do app.theme --name kage
```

Then pick it any time in Settings → Look, or `herdr-app do app.theme --name kage`.
Back to herdr's own: `herdr-app do app.theme --name graphite`.

## Avatars (not used yet)

8-bit shadow characters for agent cards, 16×16 in the kage colors: karasu (crow),
neko (cat), kage (hooded shadow), oni (demon), shinobi (ninja), ookami (wolf).

![avatars](avatars/preview.png)

Each one is a pixel grid in `avatars/avatars.json` (a letter per pixel, colors in
`palette`). `node avatars/build.mjs` turns the grids into the SVGs.
