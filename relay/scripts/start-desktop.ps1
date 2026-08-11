# Launches Relay API (if needed) + desktop window.
# Release embeds UI (stale until rebuild). -Dev uses Vite :1420 with live UI.
param(
  [switch]$Dev,
  [switch]$Rebuild
)
$ErrorActionPreference = "Stop"
$relayRoot = Split-Path $PSScriptRoot -Parent
$desktopRoot = Join-Path $relayRoot "desktop"

function Get-NpmCmd {
  $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command npm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  throw "npm not found in PATH. Install Node.js and reopen the terminal."
}

function Test-HttpReady([string]$Url) {
  try {
    $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Wait-HttpReady([string]$Url, [int]$TimeoutSec, [string]$Label) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpReady $Url) { return }
    Start-Sleep -Milliseconds 400
  }
  throw "$Label did not become ready ($Url)."
}

function Start-NpmDev([string]$WorkDir, [string]$Title) {
  $npm = Get-NpmCmd
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "title $Title && `"$npm`" run dev" `
    -WorkingDirectory $WorkDir `
    -WindowStyle Minimized
}

function Ensure-Api {
  if (Test-HttpReady "http://127.0.0.1:3000/") {
    Write-Host "API already on :3000"
    return
  }
  Write-Host "Starting API (Next.js :3000)..."
  Start-NpmDev -WorkDir $relayRoot -Title "Relay API"
  Wait-HttpReady "http://127.0.0.1:3000/" 90 "API"
  Write-Host "API ready"
}

function Ensure-Vite {
  if (Test-HttpReady "http://127.0.0.1:1420/") {
    Write-Host "Vite already on :1420"
    return
  }
  Write-Host "Starting Vite (:1420)..."
  Start-NpmDev -WorkDir $desktopRoot -Title "Relay Vite"
  Wait-HttpReady "http://127.0.0.1:1420/" 90 "Vite"
  Write-Host "Vite ready"
}

function Stop-RelayDesktop {
  Get-Process -Name "relay_desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
}

$npm = Get-NpmCmd
$releaseExe = @(
  (Join-Path $desktopRoot "src-tauri\target\release\relay_desktop.exe"),
  (Join-Path $desktopRoot "src-tauri\target\release\Relay.exe")
) | Where-Object { Test-Path $_ } | Select-Object -First 1
$debugExe = Join-Path $desktopRoot "src-tauri\target\debug\relay_desktop.exe"

if ($Rebuild) {
  Write-Host "Rebuilding release desktop (may take a few minutes)..."
  Ensure-Api
  Push-Location $desktopRoot
  try {
    & $npm run tauri:build
    if ($LASTEXITCODE -ne 0) { throw "tauri:build failed with code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
  $releaseExe = @(
    (Join-Path $desktopRoot "src-tauri\target\release\relay_desktop.exe"),
    (Join-Path $desktopRoot "src-tauri\target\release\Relay.exe")
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $releaseExe) { throw "Release exe missing after build" }
  Stop-RelayDesktop
  Write-Host "Opening release: $releaseExe"
  Start-Process -FilePath $releaseExe
  return
}

if ($Dev -or $env:RELAY_DESKTOP_DEV -eq "1") {
  Write-Host "Dev mode: API + Vite + debug exe (live UI)"
  Ensure-Api
  Ensure-Vite
  Stop-RelayDesktop
  if (-not (Test-Path $debugExe)) {
    Write-Host "No debug exe - first tauri:dev..."
    Set-Location $desktopRoot
    & $npm run tauri:dev
    return
  }
  Write-Host "Opening: $debugExe"
  Start-Process -FilePath $debugExe
  return
}

if ($releaseExe) {
  Ensure-Api
  Write-Host "Opening release: $releaseExe"
  Write-Host "Note: release UI is frozen until rebuild. After design changes use Relay-dev.bat or Relay-rebuild.bat"
  Start-Process -FilePath $releaseExe
  return
}

Write-Host "No release build - using dev mode (Vite :1420 + debug exe)."
Ensure-Api
Ensure-Vite
if (-not (Test-Path $debugExe)) {
  Write-Host "No debug exe - first tauri:dev..."
  Set-Location $desktopRoot
  & $npm run tauri:dev
  return
}
Write-Host "Opening: $debugExe"
Start-Process -FilePath $debugExe
