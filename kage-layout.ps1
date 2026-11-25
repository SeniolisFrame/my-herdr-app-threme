# kage's layout step: points a layout at the kage mods and gives its panes square 2px frames, the panes you're not in
# faded (veil 0.35, herdr 0.1.18+).
#   .\kage-layout.ps1 <layout.json>
# install.ps1 runs it, and leaves a copy in herdr-app's after-layout folder: an installer that
# rewrites a layout (my-herdr-app's) runs every script there with that layout's path, so kage
# comes back by itself. Dot-sourced without a file (uninstall.ps1), it only defines the functions.
# It also sets the layout's fonts to Unifont: a theme file can't carry fonts in herdr, a layout can,
# and its font / ui_font win over settings.json (terminals and my-herdr-app's Files and Changes follow).
param([string]$file)

# Every tab block's pane frame gets that radius, its border and focus that width, and that veil (none: no veil).
function Set-PaneFrame([string]$json, $radius, $width, $veil) {
  $root = $json | ConvertFrom-Json
  $walk = {
    param($n)
    $f = $n.content.pane
    if ($f) {
      $f | Add-Member -Force radius $radius
      if ($null -ne $veil) { $f | Add-Member -Force veil $veil } else { $f.PSObject.Properties.Remove("veil") }
      if ($f.border) { $f.border | Add-Member -Force width $width }
      if ($f.focus) { $f.focus | Add-Member -Force width $width }
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

# The row holding the witch board (the forest camps) keeps one height: the forest art is drawn for it, not stretched.
# -Free (uninstall.ps1): the row holding my-board resizes again, 120-600 as my-herdr-app ships it.
function Set-BoardFixed([string]$json, [switch]$Free) {
  $root = $json | ConvertFrom-Json
  $walk = {
    param($n)
    if (-not $Free -and (@($n.children) | Where-Object { $_.content.props.board })) {
      $h = if ($n.size.px) { $n.size.px } else { 240 }
      $n | Add-Member -Force min $h; $n | Add-Member -Force max $h
    }
    if ($Free -and (@($n.children) | Where-Object { $_.content.mod -eq "my-board" })) {
      $n | Add-Member -Force min 120; $n | Add-Member -Force max 600
    }
    foreach ($c in @($n.children)) { if ($c) { & $walk $c } }
  }
  & $walk $root
  $root | ConvertTo-Json -Depth 64
}

if ($file) {
  $json = [IO.File]::ReadAllText($file)
  # my-herdr-app's board (its top band) becomes the witch cards in columns.
  $new = $json -replace '("mod":\s*)"my-board"', '$1"kage-agents", "props": { "board": true }'
  $new = $new -replace '("mod":\s*)"agents"', '$1"kage-agents"' -replace '("mod":\s*)"spaces"', '$1"kage-spaces"' -replace '("mod":\s*)"tabs"', '$1"kage-tabs"' -replace '("mod":\s*)"pane"', '$1"kage-pane"'
  $new = Set-BoardFixed (Set-LayoutFont (Set-PaneFrame $new 0 2 0.35) "Unifont")
  if ($new -ne $json) { [IO.File]::WriteAllText($file, $new) }
}
