# Starts Relay web (API) + opens browser + launches desktop (live UI).
# Use this from the Desktop shortcut — one click for the full dev stack.
param(
  [switch]$WebOnly,
  [switch]$DesktopOnly,
  [switch]$Rebuild,
  [switch]$Release
)

$ErrorActionPreference = "Stop"
$relayRoot = Split-Path $PSScriptRoot -Parent
$startDesktop = Join-Path $PSScriptRoot "start-desktop.ps1"

function Test-HttpReady([string]$Url) {
  try {
    $res = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
    return ($res.StatusCode -ge 200 -and $res.StatusCode -lt 500)
  } catch {
    return $false
  }
}

function Ensure-Api {
  if (Test-HttpReady "http://127.0.0.1:3000/") {
    Write-Host "API already on :3000"
    return
  }
  Write-Host "Starting API (Next.js :3000)..."
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if (-not $npm) { $npm = Get-Command npm -ErrorAction SilentlyContinue }
  if (-not $npm) { throw "npm not found. Install Node.js LTS." }
  Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c", "title Relay API && `"$($npm.Source)`" run dev" `
    -WorkingDirectory $relayRoot `
    -WindowStyle Minimized
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    if (Test-HttpReady "http://127.0.0.1:3000/") {
      Write-Host "API ready"
      return
    }
    Start-Sleep -Milliseconds 400
  }
  throw "API did not start on :3000"
}

if (-not $DesktopOnly) {
  Ensure-Api
  if (-not $WebOnly) {
    Write-Host "Opening web: http://localhost:3000"
    Start-Process "http://localhost:3000"
  }
}

if ($WebOnly) { return }

$args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$startDesktop`"")
if ($Rebuild) { $args += "-Rebuild" }
if ($Release) { $args += "-Release" }

Write-Host "Starting desktop..."
& powershell.exe @args
if ($LASTEXITCODE -ne 0) { throw "Desktop launch failed with code $LASTEXITCODE" }
