# Setup Relay on a fresh Windows machine (Node, Git, Rust, deps, shortcut).
# Run in PowerShell:
#   Set-ExecutionPolicy -Scope Process Bypass
#   powershell -File scripts/setup-windows-dev.ps1
#
# From repo root wrapper:
#   powershell -File ../scripts/setup-windows-dev.ps1
#
# Optional:
#   -RepoDir "C:\dev\Relay"
#   -SkipRust       web-only
#   -SkipDesktop    skip desktop npm install
#   -SkipShortcut   skip Desktop shortcut

param(
  [string]$RepoDir = "",
  [string]$RepoUrl = "https://github.com/LevixandrX/Relay.git",
  [switch]$SkipRust,
  [switch]$SkipDesktop,
  [switch]$SkipShortcut
)

$ErrorActionPreference = "Stop"

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Command not found after install: $Name. Open a NEW PowerShell and re-run this script."
  }
}

function Ensure-Winget {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget not found. Install App Installer from Microsoft Store, then re-run."
  }
}

function Winget-Install([string]$Id) {
  Write-Host "winget install $Id ..."
  winget install --id $Id -e --accept-source-agreements --accept-package-agreements --disable-interactivity
}

if (-not $RepoDir) {
  $RepoDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

Ensure-Winget

Write-Host "==> Git"
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Winget-Install "Git.Git"
} else { Write-Host "Git already installed" }

Write-Host "==> Node.js LTS"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Winget-Install "OpenJS.NodeJS.LTS"
} else { Write-Host "Node already installed: $(node -v)" }

if (-not $SkipRust) {
  Write-Host "==> Rust (rustup)"
  if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
    Winget-Install "Rustlang.Rustup"
  } else { Write-Host "Rust already installed: $(rustc -V)" }

  Write-Host "==> WebView2 Runtime (Tauri)"
  Winget-Install "Microsoft.EdgeWebView2Runtime"
}

Write-Host ""
Write-Host "If Git/Node/Rust were just installed, CLOSE this window and open a NEW PowerShell,"
Write-Host "then re-run this script so PATH is refreshed."
Write-Host ""

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")

Assert-Command git
Assert-Command node
Assert-Command npm

if (-not $SkipRust) {
  if (Get-Command rustup -ErrorAction SilentlyContinue) {
    rustup default stable
    rustup target add x86_64-pc-windows-msvc
  }
}

Write-Host "==> Clone / update repo at $RepoDir"
$parent = Split-Path $RepoDir -Parent
if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent | Out-Null }

if (-not (Test-Path (Join-Path $RepoDir ".git"))) {
  git clone $RepoUrl $RepoDir
} elseif ((Get-Location).Path -ne $RepoDir) {
  Push-Location $RepoDir
  git pull --ff-only
  Pop-Location
} else {
  Write-Host "Already inside repo — skipping git pull"
}

$relay = Join-Path $RepoDir "relay"
if (-not (Test-Path $relay)) { throw "Expected $relay — wrong repo layout?" }

Write-Host "==> npm install (web)"
Push-Location $relay
npm install
if (-not (Test-Path ".env.local")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env.local"
    Write-Host "Created relay/.env.local from .env.example — set AUTH_SECRET (32+ chars) before auth works."
  }
}
npm run db:migrate
Pop-Location

if (-not $SkipDesktop) {
  Write-Host "==> npm install (desktop)"
  Push-Location (Join-Path $relay "desktop")
  npm install
  Pop-Location
}

if (-not $SkipShortcut -and -not $SkipDesktop) {
  Write-Host "==> Desktop shortcut (web + desktop)"
  & (Join-Path $relay "scripts\install-desktop-shortcut.ps1")
}

Write-Host ""
Write-Host "DONE."
Write-Host "Double-click Relay.lnk on Desktop — opens browser + desktop app."
Write-Host "Or manually:"
Write-Host "  cd `"$relay`""
Write-Host "  powershell -File scripts/start-relay.ps1"
Write-Host ""
Write-Host "Web only:  npm run dev  -> http://localhost:3000"
