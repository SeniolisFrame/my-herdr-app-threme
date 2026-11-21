# Copies the kage theme, the bat agent cards (mods/kage-agents), the 8-bit spaces list
# (mods/kage-spaces), tab bar (mods/kage-tabs) and pane header (mods/kage-pane) into herdr-app,
# switches to kage, and points the current layout at all four with square 2px pane frames.
# Run it again after every change or pull.
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
Copy-Item (Join-Path $PSScriptRoot "mods\kage-agents\*"), (Join-Path $PSScriptRoot "avatars\bat-*.svg") $mod -Force
# Left for installers that rewrite a layout (my-herdr-app's): they run it after, kage stays.
$hooks = Join-Path $app "after-layout"
New-Item -ItemType Directory -Force $hooks | Out-Null
Copy-Item (Join-Path $PSScriptRoot "kage-layout.ps1") (Join-Path $hooks "kage.ps1") -Force
$ErrorActionPreference = "Continue"
& herdr-app do app.theme --name kage 2>&1 | Out-Null
# Shipped layouts are read-only (Herdr restores them), so only a personal one is pointed at the mod.
$name = (& herdr-app status | ConvertFrom-Json).layout
if (-not $name) { Write-Host "Theme and mod copied, but herdr-app is not running: start it, then run this again to show the bat cards."; exit 1 }
$file = Join-Path $app "layouts\$name.json"
if ($name -in "main", "terminals", "win98") {
  Write-Host "Layout '$name' is Herdr's own: clone it (herdr-app do layout.clone) and run this again for the bat cards."
} elseif (Test-Path $file) {
  & (Join-Path $PSScriptRoot "kage-layout.ps1") $file
}
Write-Host "Installed. Back to herdr's own: .\uninstall.ps1"
