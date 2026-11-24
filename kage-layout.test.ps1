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
Assert ($f.veil -eq 0.35) "other panes veiled"
Assert ($f.header.content.mod -eq "kage-pane") "header is kage-pane"
Assert ($root.divider.width -eq 1) "window divider left alone"
Assert ($after -match '"kage-agents"' -and $after -notmatch '"mod":\s*"agents"') "agents is kage-agents"

& (Join-Path $PSScriptRoot "kage-layout.ps1") $tmp
Assert ([IO.File]::ReadAllText($tmp) -eq $after) "running twice changes nothing"

$f = Find-Frame (Set-PaneFrame $after 10 1 | ConvertFrom-Json)
Assert ($f.radius -eq 10 -and $f.border.width -eq 1 -and $null -eq $f.veil) "Set-PaneFrame 10 1 restores, veil gone"
Remove-Item $tmp

# my-herdr-app's board block becomes the witch board, once; uninstall.ps1's pattern turns it back.
'{"id":"top","children":[{"id":"board","type":"block","content":{"mod":"my-board"}}]}' | Set-Content -Encoding utf8 $tmp
& (Join-Path $PSScriptRoot "kage-layout.ps1") $tmp
$after = [IO.File]::ReadAllText($tmp)
$b = ($after | ConvertFrom-Json).children[0].content
Assert ($b.mod -eq "kage-agents" -and $b.props.board -eq $true) "my-board is kage-agents with board"
& (Join-Path $PSScriptRoot "kage-layout.ps1") $tmp
Assert ([IO.File]::ReadAllText($tmp) -eq $after) "board: running twice changes nothing"
$back = $after -replace '("mod":\s*)"kage-agents",\s*"props":\s*\{\s*"board":\s*true\s*\}', '$1"my-board"'
Assert (($back | ConvertFrom-Json).children[0].content.mod -eq "my-board") "uninstall pattern gives my-board back"
Remove-Item $tmp

# Every theme file of the repo can be picked with install.ps1 -Theme (kage, or kage-<name>).
$set = [regex]::Match([IO.File]::ReadAllText((Join-Path $PSScriptRoot "install.ps1")), 'ValidateSet\(([^)]*)\)').Groups[1].Value
Get-ChildItem (Join-Path $PSScriptRoot "themes") | ForEach-Object {
  $n = $_.BaseName -replace "^kage-", ""
  Assert ($set -match "`"$n`"") "install.ps1 -Theme lists $n"
}
"ok"
