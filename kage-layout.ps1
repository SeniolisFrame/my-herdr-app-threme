# kage's layout step: points a layout at the kage mods and gives its panes square 2px frames, the panes you're not in
# faded (veil 0.35, herdr 0.1.18+).
#   .\kage-layout.ps1 <layout.json>
# install.ps1 runs it on the my-herdr layout it copies. Dot-sourced without a file (uninstall.ps1),
# it only defines the functions.
# It also sets the layout's fonts to Unifont: a theme file can't carry fonts in herdr, a layout can,
# and its font / ui_font win over settings.json (terminals and the Files and Changes panels follow).
param([string]$file)

# Every tab block's pane frame gets that radius, its border and focus that width, that veil (none: no veil),
# and $focus = (from, to) swaps its focus colour only where it is "from": install's ("accent", "border") keeps the
# pane you click from lighting up, uninstall's ("border", "accent") undoes it; a colour of the layout's own stays.
function Set-PaneFrame([string]$json, $radius, $width, $veil, $focus) {
  $root = $json | ConvertFrom-Json
  $walk = {
    param($n)
    $f = $n.content.pane
    if ($f) {
      $f | Add-Member -Force radius $radius
      if ($null -ne $veil) { $f | Add-Member -Force veil $veil } else { $f.PSObject.Properties.Remove("veil") }
      if ($f.border) { $f.border | Add-Member -Force width $width }
      if ($f.focus) { $f.focus | Add-Member -Force width $width; if ($focus -and $f.focus.color -eq $focus[0]) { $f.focus.color = $focus[1] } }
    }
    foreach ($c in @($n.children)) { if ($c) { & $walk $c } }
  }
  & $walk $root
  $root | ConvertTo-Json -Depth 64
}

# The layout's font and ui_font: that face where it has none, or ($null) removed where kage set them (a font of the person's own stays).
function Set-LayoutFont([string]$json, $font) {
  $root = $json | ConvertFrom-Json
  foreach ($k in "font", "ui_font") {
    if ($font) { if (-not $root.$k) { $root | Add-Member $k $font } }
    elseif ($root.$k -eq "Unifont") { $root.PSObject.Properties.Remove($k) }
  }
  $root | ConvertTo-Json -Depth 64
}

# The row holding the witch board (the forest camps) keeps one height: the forest art is drawn for it, not stretched,
# and its sidebar (Spaces list, Settings) is hidden: the top bar lists the spaces and has Settings, the board the agents.
# -Free (uninstall.ps1): the row holding my-board resizes again, 120-600 as my-herdr-app ships it, its sidebar shown.
function Set-BoardFixed([string]$json, [switch]$Free) {
  $root = $json | ConvertFrom-Json
  $walk = {
    param($n)
    if (-not $Free -and (@($n.children) | Where-Object { $_.content.props.board })) {
      $h = if ($n.size.px) { $n.size.px } else { 240 }
      $n | Add-Member -Force min $h; $n | Add-Member -Force max $h
      @($n.children) | Where-Object { $_.id -eq "sidebar" } | ForEach-Object { $_ | Add-Member -Force hidden $true }
    }
    if ($Free -and (@($n.children) | Where-Object { $_.content.mod -eq "my-board" })) {
      $n | Add-Member -Force min 120; $n | Add-Member -Force max 600
      @($n.children) | Where-Object { $_.id -eq "sidebar" } | ForEach-Object { $_.PSObject.Properties.Remove("hidden") }
    }
    foreach ($c in @($n.children)) { if ($c) { & $walk $c } }
  }
  & $walk $root
  $root | ConvertTo-Json -Depth 64
}

# uninstall.ps1's step for one layout: herdr's own Agents, Spaces, tab bar, pane frames and fonts back.
# The board (kage's, or my-herdr-app's my-board) becomes herdr's Agents list: uninstall removes my-board too.
function Undo-KageLayout([string]$json) {
  # Before the plain one below: the board block's row resizes again and its sidebar shows.
  $new = $json -replace '("mod":\s*)"kage-agents",\s*"props":\s*\{\s*"board":\s*true\s*\}', '$1"my-board"'
  if ($new -ne $json) { $new = Set-BoardFixed $new -Free }
  $new = $new -replace '("mod":\s*)"my-board"', '$1"agents"'
  $new = $new -replace '("mod":\s*)"kage-agents"', '$1"agents"' -replace '("mod":\s*)"kage-spaces"', '$1"spaces"' -replace '("mod":\s*)"kage-tabs"', '$1"tabs"'
  # Pane frames back to herdr's own (as in its main layout): rounded 10, 1px border, accent focus.
  if ($new -match '"kage-pane"') { $new = Set-PaneFrame ($new -replace '("mod":\s*)"kage-pane"', '$1"pane"') 10 1 $null ("border", "accent") }
  # Apart from the frames: a layout without a pane header (terminals) got the fonts too.
  if ($new -match '"(ui_)?font":\s*"Unifont"') { $new = Set-LayoutFont $new $null }
  $new
}

if ($file) {
  $json = [IO.File]::ReadAllText($file)
  # my-herdr-app's board (its top band) becomes the witch cards in columns.
  $new = $json -replace '("mod":\s*)"my-board"', '$1"kage-agents", "props": { "board": true }'
  $new = $new -replace '("mod":\s*)"agents"', '$1"kage-agents"' -replace '("mod":\s*)"spaces"', '$1"kage-spaces"' -replace '("mod":\s*)"tabs"', '$1"kage-tabs"' -replace '("mod":\s*)"pane"', '$1"kage-pane"'
  $new = Set-BoardFixed (Set-LayoutFont (Set-PaneFrame $new 0 2 0.35 ("accent", "border")) "Unifont")
  if ($new -ne $json) { [IO.File]::WriteAllText($file, $new) }
}
