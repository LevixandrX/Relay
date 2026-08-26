# Wrapper — run setup from repo root after clone.
param(
  [switch]$SkipRust,
  [switch]$SkipDesktop,
  [switch]$SkipShortcut
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$inner = Join-Path $repoRoot "relay\scripts\setup-windows-dev.ps1"
if (-not (Test-Path $inner)) { throw "Missing $inner" }

$params = @{ RepoDir = $repoRoot }
if ($SkipRust) { $params.SkipRust = $true }
if ($SkipDesktop) { $params.SkipDesktop = $true }
if ($SkipShortcut) { $params.SkipShortcut = $true }

& $inner @params
