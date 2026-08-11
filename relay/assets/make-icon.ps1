Add-Type -AssemblyName System.Drawing

function New-RoundedPath {
    param(
        [double]$X, [double]$Y, [double]$W, [double]$H, [double]$R
    )
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = [float](2 * $R)
    if ($R -le 0) {
        $path.AddRectangle((New-Object System.Drawing.RectangleF([float]$X, [float]$Y, [float]$W, [float]$H)))
        return $path
    }
    $path.AddArc([float]$X, [float]$Y, $d, $d, 180, 90)
    $path.AddArc([float]($X + $W - $d), [float]$Y, $d, $d, 270, 90)
    $path.AddArc([float]($X + $W - $d), [float]($Y + $H - $d), $d, $d, 0, 90)
    $path.AddArc([float]$X, [float]($Y + $H - $d), $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-Icon {
    param(
        [int]$Size,
        [string]$OutPath,
        [System.Drawing.Color]$Background,
        [System.Drawing.Color]$Mark,
        [double]$CornerRatio = 0.0,
        [bool]$TransparentCorners = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $bgBrush = New-Object System.Drawing.SolidBrush($Background)
    if ($TransparentCorners -and $CornerRatio -gt 0) {
        $r = $Size * $CornerRatio
        $bgPath = New-RoundedPath -X 0 -Y 0 -W $Size -H $Size -R $r
        $g.FillPath($bgBrush, $bgPath)
        $bgPath.Dispose()
    } else {
        $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    }
    $bgBrush.Dispose()

    # Mark geometry, expressed as fractions of the canvas.
    $nodeSide = 0.215 * $Size
    $nodeR = 0.052 * $Size
    $strokeW = 0.058 * $Size

    $aX = 0.252 * $Size
    $aY = 0.533 * $Size
    $bX = 0.533 * $Size
    $bY = 0.252 * $Size

    $aCx = $aX + $nodeSide / 2
    $aCy = $aY + $nodeSide / 2
    $bCx = $bX + $nodeSide / 2
    $bCy = $bY + $nodeSide / 2

    $markBrush = New-Object System.Drawing.SolidBrush($Mark)
    $pen = New-Object System.Drawing.Pen($Mark, [float]$strokeW)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    # Connector sits under the nodes so it reads as one continuous shape.
    $g.DrawLine($pen, [float]$aCx, [float]$aCy, [float]$bCx, [float]$bCy)

    $nodeA = New-RoundedPath -X $aX -Y $aY -W $nodeSide -H $nodeSide -R $nodeR
    $nodeB = New-RoundedPath -X $bX -Y $bY -W $nodeSide -H $nodeSide -R $nodeR
    $g.FillPath($markBrush, $nodeA)
    $g.FillPath($markBrush, $nodeB)
    $nodeA.Dispose()
    $nodeB.Dispose()

    $pen.Dispose()
    $markBrush.Dispose()
    $g.Dispose()

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host ("wrote {0} ({1} bytes)" -f $OutPath, (Get-Item $OutPath).Length)
}

$out = $args[0]
if (-not $out) { throw "pass output dir" }
New-Item -ItemType Directory -Force -Path $out | Out-Null

$blue = [System.Drawing.ColorTranslator]::FromHtml("#1D4ED8")
$white = [System.Drawing.Color]::White
$lightBg = [System.Drawing.ColorTranslator]::FromHtml("#F3F5FA")

# Primary for OAuth consoles: full-bleed square, no transparency, service applies its own mask.
New-Icon -Size 512 -OutPath (Join-Path $out "relay-oauth-icon.png") -Background $blue -Mark $white
New-Icon -Size 1024 -OutPath (Join-Path $out "relay-oauth-icon@1024.png") -Background $blue -Mark $white

# Rounded light variant for our own UI / docs.
New-Icon -Size 512 -OutPath (Join-Path $out "relay-icon-light.png") -Background $lightBg -Mark $blue -CornerRatio 0.22 -TransparentCorners $true
