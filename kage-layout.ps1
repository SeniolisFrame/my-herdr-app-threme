# kage's layout step: points a layout at the kage mods and gives its panes square 2px frames.
#   .\kage-layout.ps1 <layout.json>
# install.ps1 runs it, and leaves a copy in herdr-app's after-layout folder: an installer that
# rewrites a layout (my-herdr-app's) runs every script there with that layout's path, so kage
# comes back by itself. Dot-sourced without a file (uninstall.ps1), it only defines Set-PaneFrame.
param([string]$file)

# Every tab block's pane frame gets that radius, and its border and focus that width.
function Set-PaneFrame([string]$json, $radius, $width) {
  $root = $json | ConvertFrom-Json
  $walk = {
    param($n)
    $f = $n.content.pane
    if ($f) {
      $f | Add-Member -Force radius $radius
      if ($f.border) { $f.border | Add-Member -Force width $width }
      if ($f.focus) { $f.focus | Add-Member -Force width $width }
    }
    foreach ($c in @($n.children)) { if ($c) { & $walk $c } }
  }
  & $walk $root
  $root | ConvertTo-Json -Depth 64
}

if ($file) {
  $json = [IO.File]::ReadAllText($file)
  $new = $json -replace '("mod":\s*)"agents"', '$1"kage-agents"' -replace '("mod":\s*)"spaces"', '$1"kage-spaces"' -replace '("mod":\s*)"tabs"', '$1"kage-tabs"' -replace '("mod":\s*)"pane"', '$1"kage-pane"'
  $new = Set-PaneFrame $new 0 2
  if ($new -ne $json) { [IO.File]::WriteAllText($file, $new) }
}
