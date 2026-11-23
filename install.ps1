# Copies the kage theme, the bat agent cards (mods/kage-agents), the 8-bit spaces list
# (mods/kage-spaces), tab bar (mods/kage-tabs) and pane header (mods/kage-pane) into herdr-app,
# switches to kage, and points the current layout at all four with square 2px pane frames.
# Run it again after every change or pull. -Theme midnight|sakura|forest|ember|ocean: another color set, same mods.
param([ValidateSet("kage", "midnight", "sakura", "forest", "ember", "ocean")][string]$Theme = "kage")
$ErrorActionPreference = "Stop"
$app = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME ".config\herdr-app" }
if (-not (Test-Path $app)) { throw "herdr-app folder not found: $app (start herdr-app once first)" }
$mod = Join-Path $app "mods\kage-agents"
New-Item -ItemType Directory -Force (Join-Path $app "themes"), $mod | Out-Null
Copy-Item -Recurse -Force (Join-Path $PSScriptRoot "mods\kage-spaces"), (Join-Path $PSScriptRoot "mods\kage-tabs"), (Join-Path $PSScriptRoot "mods\kage-pane") (Join-Path $app "mods")
Copy-Item (Join-Path $PSScriptRoot "themes\*.json") (Join-Path $app "themes") -Force
# programs.json may hold the person's own entries: write it only when there is none.
$programs = Join-Path $app "programs.json"
if (-not (Test-Path $programs)) { Copy-Item (Join-Path $PSScriptRoot "programs.json") $programs }
elseif ([IO.File]::ReadAllText($programs) -ne [IO.File]::ReadAllText((Join-Path $PSScriptRoot "programs.json"))) {
  Write-Host "programs.json exists: add the claude entry from $PSScriptRoot\programs.json by hand for the violet Claude icon." }
Copy-Item (Join-Path $PSScriptRoot "mods\kage-agents\*") $mod -Force
# Bigger text for Unifont in my-herdr-app's Files and Changes (it reads this file; restart herdr-app).
# Someone's own file is left alone.
$text = Join-Path $app "my-herdr-text.json"
if (-not (Test-Path $text) -or [IO.File]::ReadAllText($text) -eq [IO.File]::ReadAllText((Join-Path $PSScriptRoot "my-herdr-text.json"))) { Copy-Item (Join-Path $PSScriptRoot "my-herdr-text.json") $text -Force }
else { Write-Host "my-herdr-text.json exists: set the sizes from $PSScriptRoot\my-herdr-text.json by hand." }
# Both avatars go in: the Agents list's menu (the sort button) picks one.
Copy-Item (Join-Path $PSScriptRoot "avatars\*.svg") $mod -Force
# Left for installers that rewrite a layout (my-herdr-app's): they run it after, kage stays.
$hooks = Join-Path $app "after-layout"
New-Item -ItemType Directory -Force $hooks | Out-Null
Copy-Item (Join-Path $PSScriptRoot "kage-layout.ps1") (Join-Path $hooks "kage.ps1") -Force
$ErrorActionPreference = "Continue"
# -Theme sakura is the theme file kage-sakura (a prefix: no clash with a theme of your own).
$themeName = if ($Theme -eq "kage") { "kage" } else { "kage-$Theme" }
& herdr-app do app.theme --name $themeName 2>&1 | Out-Null
# Shipped layouts are read-only (Herdr restores them), so only a personal one is pointed at the mod.
$name = (& herdr-app status | ConvertFrom-Json).layout
if (-not $name) { Write-Host "Theme and mod copied, but herdr-app is not running: start it, then run this again to show the cards."; exit 1 }
$file = Join-Path $app "layouts\$name.json"
if ($name -in "main", "terminals", "win98") {
  Write-Host "Layout '$name' is Herdr's own: clone it (herdr-app do layout.clone) and run this again for the cards."
} elseif (Test-Path $file) {
  & (Join-Path $PSScriptRoot "kage-layout.ps1") $file
}
Write-Host "Installed. Back to herdr's own: .\uninstall.ps1"
