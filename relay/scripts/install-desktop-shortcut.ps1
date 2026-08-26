# One Desktop shortcut with rounded app icon.
$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
$relayRoot = Split-Path $scriptDir -Parent
$startScript = Join-Path $scriptDir "start-relay.ps1"
$iconsDir = Join-Path $relayRoot "desktop\src-tauri\icons"
$srcIco = Join-Path $iconsDir "icon.ico"
$shortcutIco = Join-Path $iconsDir "relay-app.ico"
$desktop = [Environment]::GetFolderPath("Desktop")

@(
  "Relay.bat",
  "Relay.vbs",
  "Relay-dev.bat",
  "Relay-rebuild.bat",
  "Relay.lnk"
) | ForEach-Object {
  $p = Join-Path $desktop $_
  if (Test-Path $p) { Remove-Item $p -Force }
}

if (-not (Test-Path $startScript)) { throw "Missing $startScript" }
if (-not (Test-Path $srcIco)) { throw "Missing icon $srcIco" }

Copy-Item $srcIco $shortcutIco -Force

$lnkPath = Join-Path $desktop "Relay.lnk"
$w = New-Object -ComObject WScript.Shell
$lnk = $w.CreateShortcut($lnkPath)
$lnk.TargetPath = "powershell.exe"
$lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`""
$lnk.WorkingDirectory = $relayRoot
$lnk.IconLocation = "$shortcutIco,0"
$lnk.Description = "Relay — web + desktop (API, browser, live UI)"
$lnk.WindowStyle = 1
$lnk.Save()

Write-Host "Installed: $lnkPath"
Write-Host "Icon: $shortcutIco"
