# Copies the kage theme, the bat agent cards (mods/kage-agents), the 8-bit spaces list
# (mods/kage-spaces) and tab bar (mods/kage-tabs) into herdr-app, switches to kage and
# points the current layout at all three.
# Run it again after every change or pull.
$ErrorActionPreference = "Stop"
$app = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME ".config\herdr-app" }
if (-not (Test-Path $app)) { throw "herdr-app folder not found: $app (start herdr-app once first)" }
$mod = Join-Path $app "mods\kage-agents"
New-Item -ItemType Directory -Force (Join-Path $app "themes"), $mod | Out-Null
Copy-Item -Recurse -Force (Join-Path $PSScriptRoot "mods\kage-spaces"), (Join-Path $PSScriptRoot "mods\kage-tabs") (Join-Path $app "mods")
Copy-Item (Join-Path $PSScriptRoot "themes\*.json") (Join-Path $app "themes") -Force
Copy-Item (Join-Path $PSScriptRoot "mods\kage-agents\*"), (Join-Path $PSScriptRoot "avatars\bat-*.svg") $mod -Force
$ErrorActionPreference = "Continue"
& herdr-app do app.theme --name kage 2>&1 | Out-Null
# Shipped layouts are read-only (Herdr restores them), so only a personal one is pointed at the mod.
$name = (& herdr-app status | ConvertFrom-Json).layout
if (-not $name) { Write-Host "Theme and mod copied, but herdr-app is not running: start it, then run this again to show the bat cards."; exit 1 }
$file = Join-Path $app "layouts\$name.json"
if ($name -in "main", "terminals", "win98") {
  Write-Host "Layout '$name' is Herdr's own: clone it (herdr-app do layout.clone) and run this again for the bat cards."
} elseif (Test-Path $file) {
  $json = Get-Content $file -Raw
  $new = $json -replace '("mod":\s*)"agents"', '$1"kage-agents"' -replace '("mod":\s*)"spaces"', '$1"kage-spaces"' -replace '("mod":\s*)"tabs"', '$1"kage-tabs"'
  if ($new -ne $json) { [IO.File]::WriteAllText($file, $new) }
}
Write-Host "Installed. Back to herdr's own: .\uninstall.ps1"
