# Launches Relay desktop with LIVE UI via `tauri:dev` (Vite :1420 + cargo).
#
# Do not open a prebuilt exe for daily use — it embeds frontendDist (frozen UI).
# Do not pass --no-dev-server: that flag is unrelated to Vite and breaks:dev.
#
# -Rebuild / -Release: optional frozen release builds only.
param(
  [switch]$Dev,
  [switch]$Rebuild,
  [switch]$Release
)
$ErrorActionPreference = "Stop"
$relayRoot = Split-Path $PSScriptRoot -Parent
$desktopRoot = Join-Path $relayRoot "desktop"

# Shortcut launches inherit a thin PATH — make sure cargo/npm/MSVC are visible.
function Ensure-DevPath {
  $parts = @(
    (Join-Path $env:USERPROFILE ".cargo\bin"),
    "${env:ProgramFiles}\nodejs",
    "${env:ProgramFiles(x86)}\nodejs"
  )
  foreach ($p in $parts) {
    if ($p -and (Test-Path $p) -and ($env:Path -notlike "*$p*")) {
      $env:Path = "$p;$env:Path"
    }
  }
  if (-not (Get-Command link.exe -ErrorAction SilentlyContinue)) {
    $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vswhere) {
      $vsDev = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
      if ($vsDev) {
        $vcvars = Join-Path $vsDev "VC\Auxiliary\Build\vcvars64.bat"
        if (Test-Path $vcvars) {
          cmd /c "`"$vcvars`" >nul && set" | ForEach-Object {
            if ($_ -match '^([^=]+)=(.*)$') {
              [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
            }
          }
        }
      }
    }
  }
}

Ensure-DevPath

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

function Stop-ListenersOnPort([int]$Port) {
  $pids = @()
  try {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  } catch {
    # fallback below
  }
  if (-not $pids) {
    $lines = netstat -ano | Select-String ":$Port\s+.*LISTENING"
    foreach ($line in $lines) {
      $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }
      if ($parts.Count -ge 5) { $pids += [int]$parts[-1] }
    }
    $pids = $pids | Select-Object -Unique
  }
  foreach ($procId in $pids) {
    if ($procId -and $procId -ne 0) {
      Write-Host "Stopping PID $procId on :$Port"
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Ensure-Api {
  if (Test-HttpReady "http://127.0.0.1:3000/") {
    Write-Host "API already on :3000"
    return
  }
  Write-Host "Starting API (Next.js :3000)..."
  $npm = Get-NpmCmd
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "title Relay API && `"$npm`" run dev" `
    -WorkingDirectory $relayRoot `
    -WindowStyle Minimized
  Wait-HttpReady "http://127.0.0.1:3000/" 90 "API"
  Write-Host "API ready"
}

function Stop-RelayDesktop {
  Get-Process -Name "relay_desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
}

$npm = Get-NpmCmd
$releaseExe = @(
  (Join-Path $desktopRoot "src-tauri\target\release\relay_desktop.exe"),
  (Join-Path $desktopRoot "src-tauri\target\release\Relay.exe")
) | Where-Object { Test-Path $_ } | Select-Object -First 1

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

if ($Release) {
  if (-not $releaseExe) { throw "No release build. Run with -Rebuild first." }
  Ensure-Api
  Write-Host "Opening frozen release: $releaseExe"
  Write-Host "UI updates need the default live shortcut (tauri:dev)."
  Start-Process -FilePath $releaseExe
  return
}

# Default: one tauri:dev owns Vite (:1420). Free the port first so beforeDevCommand can bind.
Write-Host "Relay launch: API + tauri:dev (Vite live UI)"
Ensure-Api
Stop-RelayDesktop
Write-Host "Freeing :1420 for tauri:dev Vite..."
Stop-ListenersOnPort 1420
Start-Sleep -Milliseconds 400

Push-Location $desktopRoot
try {
  Write-Host "Starting tauri:dev (starts Vite itself on :1420)..."
  & $npm run tauri:dev
  if ($LASTEXITCODE -ne 0) { throw "tauri:dev failed with code $LASTEXITCODE" }
} finally {
  Pop-Location
}
