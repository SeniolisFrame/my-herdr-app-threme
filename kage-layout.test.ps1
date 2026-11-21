# Checks kage-layout.ps1 on a copy of herdr's main layout: .\kage-layout.test.ps1 (prints "ok").
$ErrorActionPreference = "Stop"
$app = if ($env:HERDR_APP_HOME) { $env:HERDR_APP_HOME } else { Join-Path $HOME ".config\herdr-app" }
$tmp = Join-Path ([IO.Path]::GetTempPath()) "kage-layout-test.json"
Copy-Item (Join-Path $app "layouts\main.json") $tmp -Force
. (Join-Path $PSScriptRoot "kage-layout.ps1")
function Find-Frame($n) { if ($n.content.pane) { return $n.content.pane }; foreach ($c in @($n.children)) { if ($c) { $f = Find-Frame $c; if ($f) { return $f } } } }
function Assert($ok, $what) { if (-not $ok) { throw "FAIL: $what" } }

& (Join-Path $PSScriptRoot "kage-layout.ps1") $tmp
$after = [IO.File]::ReadAllText($tmp)
$root = $after | ConvertFrom-Json
$f = Find-Frame $root
Assert ($f.radius -eq 0) "radius 0"
Assert ($f.border.width -eq 2 -and $f.focus.width -eq 2) "border and focus 2px"
Assert ($f.header.content.mod -eq "kage-pane") "header is kage-pane"
Assert ($root.divider.width -eq 1) "window divider left alone"
Assert ($after -match '"kage-agents"' -and $after -notmatch '"mod":\s*"agents"') "agents is kage-agents"

& (Join-Path $PSScriptRoot "kage-layout.ps1") $tmp
Assert ([IO.File]::ReadAllText($tmp) -eq $after) "running twice changes nothing"

$f = Find-Frame (Set-PaneFrame $after 10 1 | ConvertFrom-Json)
Assert ($f.radius -eq 10 -and $f.border.width -eq 1) "Set-PaneFrame 10 1 restores"
Remove-Item $tmp
"ok"
