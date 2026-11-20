param($json, $out)
# powershell -File avatars/preview.ps1 avatars/avatars.json avatars/preview.png
# The same pixel grids, drawn 8x on the kage background in a row, each with its name.
Add-Type -AssemblyName System.Drawing
$d = Get-Content $json -Raw | ConvertFrom-Json
$names = $d.avatars.PSObject.Properties.Name
$scale = 8; $size = $d.avatars.($names[0]).Count; $cell = $size * $scale; $pad = 24
$bmp = New-Object System.Drawing.Bitmap ([int]($names.Count * ($cell + $pad) + $pad)), ([int]($cell + 2 * $pad + 24))
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.ColorTranslator]::FromHtml("#050408"))
$font = New-Object System.Drawing.Font("Consolas", 12)
$x0 = $pad
foreach ($n in $names) {
  $rows = $d.avatars.$n
  for ($y = 0; $y -lt $size; $y++) { for ($x = 0; $x -lt $size; $x++) {
    $ch = [string]$rows[$y][$x]
    if ($ch -eq ".") { continue }
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($d.palette.$ch))
    $g.FillRectangle($brush, $x0 + $x * $scale, $pad + $y * $scale, $scale, $scale)
  } }
  $g.DrawString($n, $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#aca3cc"))), $x0, $pad + $cell + 6)
  $x0 += $cell + $pad
}
$bmp.Save($out)
