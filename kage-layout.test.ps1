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
Assert ($f.focus.color -eq "border") "focused pane's border no brighter than the rest"
Assert ($f.header.content.mod -eq "kage-pane") "header is kage-pane"
Assert ($root.divider.width -eq 1) "window divider left alone"
Assert ($root.font -eq "Unifont" -and $root.ui_font -eq "Unifont") "layout fonts are Unifont"
Assert ($after -match '"kage-agents"' -and $after -notmatch '"mod":\s*"agents"') "agents is kage-agents"

& (Join-Path $PSScriptRoot "kage-layout.ps1") $tmp
Assert ([IO.File]::ReadAllText($tmp) -eq $after) "running twice changes nothing"

$f = Find-Frame (Set-PaneFrame $after 10 1 $null ("border", "accent") | ConvertFrom-Json)
Assert ($f.radius -eq 10 -and $f.border.width -eq 1 -and $null -eq $f.veil -and $f.focus.color -eq "accent") "uninstall's Set-PaneFrame restores herdr's frame"
$r = Set-LayoutFont $after $null | ConvertFrom-Json
Assert ($null -eq $r.font -and $null -eq $r.ui_font) "Set-LayoutFont null removes kage's fonts"
$r = Set-LayoutFont '{"font":"Fira Code"}' $null | ConvertFrom-Json
Assert ($r.font -eq "Fira Code") "a font of the person's own stays"
# win98 has fonts of its own: install keeps them, uninstall's step leaves them.
Copy-Item (Join-Path $app "layouts\win98.json") $tmp -Force
& (Join-Path $PSScriptRoot "kage-layout.ps1") $tmp
$r = Set-LayoutFont ([IO.File]::ReadAllText($tmp)) $null | ConvertFrom-Json
Assert ($r.font -eq "PxPlus IBM VGA 8x16" -and $r.ui_font -eq "Pixelated MS Sans Serif") "win98's own fonts survive install and uninstall"
$f = Find-Frame (Set-PaneFrame ([IO.File]::ReadAllText($tmp)) 10 1 $null ("border", "accent") | ConvertFrom-Json)
Assert ($f.focus.color -eq "#c0c0c0") "win98's own focus colour survives install and uninstall"
Remove-Item $tmp

# my-herdr-app's board block becomes the witch board, once; uninstall.ps1's pattern turns it back.
'{"id":"top","size":{"px":240},"min":120,"max":600,"children":[{"id":"sidebar","type":"column"},{"id":"board","type":"block","content":{"mod":"my-board"}}]}' | Set-Content -Encoding utf8 $tmp
& (Join-Path $PSScriptRoot "kage-layout.ps1") $tmp
$after = [IO.File]::ReadAllText($tmp)
$b = ($after | ConvertFrom-Json).children[1].content
Assert ($b.mod -eq "kage-agents" -and $b.props.board -eq $true) "my-board is kage-agents with board"
$top = $after | ConvertFrom-Json
Assert ($top.min -eq 240 -and $top.max -eq 240) "the board's row is fixed at its height"
Assert ($top.children[0].hidden -eq $true) "the board's sidebar is hidden"
& (Join-Path $PSScriptRoot "kage-layout.ps1") $tmp
Assert ([IO.File]::ReadAllText($tmp) -eq $after) "board: running twice changes nothing"
$free = Undo-KageLayout $after | ConvertFrom-Json
# uninstall.ps1 removes my-board with the rest: herdr's own Agents list takes the board's place.
Assert ($free.children[1].content.mod -eq "agents" -and $null -eq $free.children[1].content.props.board) "uninstall gives the board to herdr's Agents"
Assert ($free.min -eq 120 -and $free.max -eq 600) "uninstall lets the board's row resize again"
Assert ($null -eq $free.children[0].hidden) "uninstall shows the sidebar again"
Assert ((Undo-KageLayout '{"content":{"mod":"my-board"}}' | ConvertFrom-Json).content.mod -eq "agents") "an older my-board block goes to herdr's Agents too"
Remove-Item $tmp

# Every theme file of the repo can be picked with install.ps1 -Theme (kage, or kage-<name>).
$set = [regex]::Match([IO.File]::ReadAllText((Join-Path $PSScriptRoot "install.ps1")), 'ValidateSet\(([^)]*)\)').Groups[1].Value
Get-ChildItem (Join-Path $PSScriptRoot "themes") | ForEach-Object {
  $n = $_.BaseName -replace "^kage-", ""
  Assert ($set -match "`"$n`"") "install.ps1 -Theme lists $n"
}
"ok"
