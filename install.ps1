# Copies the kage theme, the witch agent cards (mods/kage-agents), the 8-bit spaces list
# (mods/kage-spaces), tab bar (mods/kage-tabs), pane header (mods/kage-pane), Files and Changes
# (mods/my-files, mods/my-changes) and the my-herdr layout into herdr-app, switches to both,
# and points the layout at the kage mods with square 2px pane frames.
# Run it again after every change or pull. -Theme midnight|sakura|forest|ember|ocean|abyss: another color set, same mods.
param([ValidateSet("kage", "midnight", "sakura", "forest", "ember", "ocean", "abyss")][string]$Theme = "kage")
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
# The witch's sleeping frames (the casting ones are in mods/kage-agents). The bat is gone: drop an older install's.
Copy-Item (Join-Path $PSScriptRoot "avatars\witch-*.png") $mod -Force
Remove-Item (Join-Path $mod "bat-*.svg"), (Join-Path $mod "witch-awake*.png"), (Join-Path $mod "witch-icon.png"), (Join-Path $mod "witch-*.svg"), (Join-Path $mod "witch-sleep.png"), (Join-Path $mod "witch-black-sleep.png") -ErrorAction SilentlyContinue
# Files, Changes and the board (formerly the my-herdr-app repo): a mod can't import from outside its
# folder, so each gets its own copy of shared/*.js (in the repo too, git-ignored), then herdr-app checks it.
foreach ($m in "my-files", "my-changes", "my-board") {
  Copy-Item (Join-Path $PSScriptRoot "shared\*.js") (Join-Path $PSScriptRoot "mods\$m") -Force
  $link = Join-Path $app "mods\$m"
  $item = Get-Item $link -ErrorAction SilentlyContinue
  if ($item -and $item.LinkType) { $item.Delete() } # an older install linked it
  New-Item -ItemType Directory -Force $link | Out-Null
  Copy-Item (Join-Path $PSScriptRoot "mods\$m\*") $link -Force -Recurse -Exclude *.test.mjs
  $ErrorActionPreference = "Continue" # herdr-app is a GUI exe: PowerShell only waits for it through a pipe
  $out = & herdr-app check $link 2>&1 | Out-String
  $ErrorActionPreference = "Stop"
  if ($out -notmatch "check passed") { throw "check failed: $m`n$out" }
}
# The my-herdr layout, fresh each time (it replaces the whole file), made kage's, then shown.
$layout = Join-Path $app "layouts\my-herdr.json"
Copy-Item (Join-Path $PSScriptRoot "layouts\my-herdr.json") $layout -Force
& (Join-Path $PSScriptRoot "kage-layout.ps1") $layout
# The hook an older install left for my-herdr-app's installer: nothing runs that now.
Remove-Item (Join-Path $app "after-layout\kage.ps1") -ErrorAction SilentlyContinue
$ErrorActionPreference = "Continue"
# -Theme sakura is the theme file kage-sakura (a prefix: no clash with a theme of your own).
$themeName = if ($Theme -eq "kage") { "kage" } else { "kage-$Theme" }
& herdr-app do app.theme --name $themeName 2>&1 | Out-Null
& herdr-app do layout.switch --name my-herdr 2>&1 | Out-Null
Write-Host "Installed. Back to herdr's own: .\uninstall.ps1"
