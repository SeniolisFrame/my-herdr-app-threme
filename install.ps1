# Copies the kage theme and the bat agent cards (mods/kage-agents) into herdr-app,
# switches to kage and points the current layout's agents list at kage-agents.
# Run it again after every change or pull.
$ErrorActionPreference = "Stop"
$app = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME ".config\herdr-app" }
if (-not (Test-Path $app)) { throw "herdr-app folder not found: $app (start herdr-app once first)" }
$mod = Join-Path $app "mods\kage-agents"
New-Item -ItemType Directory -Force (Join-Path $app "themes"), $mod | Out-Null
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
  $new = $json -replace '("mod":\s*)"agents"', '$1"kage-agents"'
  if ($new -ne $json) { [IO.File]::WriteAllText($file, $new) }
}
Write-Host "Installed. Back to herdr's own: 'herdr-app do app.theme --name graphite' and put `"agents`" back in the layout."
