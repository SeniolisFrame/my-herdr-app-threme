# Undoes install.ps1: the layout's Agents block back to herdr's "agents", the theme back to
# graphite, the kage theme and the kage-agents mod removed. Herdr keeps shared state in memory,
# so the space tile colors can only be reset while it is closed: run this again then.
$app = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME ".config\herdr-app" }
if (-not (Test-Path $app)) { throw "herdr-app folder not found: $app" }
$status = try { & herdr-app status 2>$null | ConvertFrom-Json } catch { $null }

# Every personal layout, not just the open one: install.ps1 may have run with another open.
Get-ChildItem (Join-Path $app "layouts") -Filter *.json | ForEach-Object {
  $json = [IO.File]::ReadAllText($_.FullName)
  $new = $json -replace '("mod":\s*)"kage-agents"', '$1"agents"'
  if ($new -ne $json) { [IO.File]::WriteAllText($_.FullName, $new); Write-Host "Layout $($_.BaseName): Agents list restored." }
}

if ($status) {
  & herdr-app do app.theme --name graphite 2>&1 | Out-Null
  Remove-Item -Recurse -Force (Join-Path $app "mods\kage-agents"), (Join-Path $app "themes\kage.json") -ErrorAction SilentlyContinue
  Write-Host "Theme back to graphite; kage theme and mod removed."
  Write-Host "Space tiles keep their kage colors until you close herdr-app and run this again."
} else {
  Remove-Item -Recurse -Force (Join-Path $app "mods\kage-agents") -ErrorAction SilentlyContinue
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
