# Copies themes/*.json into herdr-app's themes folder and switches to kage.
# Run it again after every change or pull.
$ErrorActionPreference = "Stop"
$app = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME ".config\herdr-app" }
if (-not (Test-Path $app)) { throw "herdr-app folder not found: $app (start herdr-app once first)" }
New-Item -ItemType Directory -Force (Join-Path $app "themes") | Out-Null
Copy-Item (Join-Path $PSScriptRoot "themes\*.json") (Join-Path $app "themes") -Force
$ErrorActionPreference = "Continue"
& herdr-app do app.theme --name kage 2>&1 | Out-Null
Write-Host "Installed. Settings -> Look picks a theme; 'herdr-app do app.theme --name graphite' goes back."
