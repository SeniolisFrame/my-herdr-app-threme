# Undoes install.ps1: the layout's Agents, Spaces and tab bar back to herdr's own, the theme back to
# graphite, the kage theme and the kage-agents mod removed. Herdr keeps shared state in memory,
# so the space tile colors can only be reset while it is closed: run this again then.
$app = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME ".config\herdr-app" }
if (-not (Test-Path $app)) { throw "herdr-app folder not found: $app" }
. (Join-Path $PSScriptRoot "kage-layout.ps1")
# No more kage after another installer rewrites a layout.
Remove-Item (Join-Path $app "after-layout\kage.ps1") -ErrorAction SilentlyContinue
$status = try { & herdr-app status 2>$null | ConvertFrom-Json } catch { $null }

# programs.json goes only if it is still exactly ours (the person may have added entries).
$programs = Join-Path $app "programs.json"
if ((Test-Path $programs) -and [IO.File]::ReadAllText($programs) -eq [IO.File]::ReadAllText((Join-Path $PSScriptRoot "programs.json"))) {
  Remove-Item $programs; Write-Host "programs.json removed: the Claude icon is orange again." }

# my-herdr-text.json goes only if it is still exactly ours.
$text = Join-Path $app "my-herdr-text.json"
if ((Test-Path $text) -and [IO.File]::ReadAllText($text) -eq [IO.File]::ReadAllText((Join-Path $PSScriptRoot "my-herdr-text.json"))) { Remove-Item $text }

# Every personal layout, not just the open one: install.ps1 may have run with another open.
Get-ChildItem (Join-Path $app "layouts") -Filter *.json | ForEach-Object {
  $json = [IO.File]::ReadAllText($_.FullName)
  # The dungeon makes the tab bar 128px: back to herdr's 42.
  $new = $json -replace '("id":\s*"tabs"[^}]*?"px":\s*)(88|128)', '${1}42'
  $new = $new -replace '("mod":\s*)"kage-agents"', '$1"agents"' -replace '("mod":\s*)"kage-spaces"', '$1"spaces"' -replace '("mod":\s*)"kage-tabs"', '$1"tabs"'
  # Pane frames back to herdr's own (as in its main layout): rounded 10, 1px border.
  if ($new -match '"kage-pane"') { $new = Set-PaneFrame ($new -replace '("mod":\s*)"kage-pane"', '$1"pane"') 10 1 }
  if ($new -ne $json) { [IO.File]::WriteAllText($_.FullName, $new); Write-Host "Layout $($_.BaseName): Agents, Spaces, tab bar and pane frames restored." }
}

# Every theme of this repo leaves with it.
$themes = @(Get-ChildItem (Join-Path $PSScriptRoot "themes") | ForEach-Object { Join-Path $app "themes\$($_.Name)" })
if ($status) {
  & herdr-app do app.theme --name graphite 2>&1 | Out-Null
  Remove-Item -Recurse -Force ($themes + @("kage-agents", "kage-spaces", "kage-tabs", "kage-pane" | ForEach-Object { Join-Path $app "mods\$_" })) -ErrorAction SilentlyContinue
  Write-Host "Theme back to graphite; kage theme and mod removed."
  Write-Host "Space tiles keep their kage colors until you close herdr-app and run this again."
} else {
  Remove-Item -Recurse -Force (Join-Path $app "mods\kage-agents"), (Join-Path $app "mods\kage-spaces"), (Join-Path $app "mods\kage-tabs"), (Join-Path $app "mods\kage-pane") -ErrorAction SilentlyContinue
  # Herdr is closed: drop the kage hex colors so it hands out its own again on the next start.
  $file = Join-Path $app "shared.json"
  if (Test-Path $file) {
    # .NET's serializer, not ConvertFrom-Json: that one fails on keys differing only in case.
    Add-Type -AssemblyName System.Web.Extensions
    $js = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $js.MaxJsonLength = [int]::MaxValue
    $shared = $js.DeserializeObject([IO.File]::ReadAllText($file))
    if ($shared.ContainsKey("space.colors")) {
      Copy-Item $file "$file.bak" -Force
      [void]$shared.Remove("space.colors")
      [IO.File]::WriteAllText($file, $js.Serialize($shared))
      Write-Host "Space colors reset (backup: shared.json.bak)."
    }
  }
  Write-Host "Mod removed. Start herdr-app; if it still shows kage, pick another theme in Settings -> Look."
}
