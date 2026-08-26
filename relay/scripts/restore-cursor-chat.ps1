# Restore Cursor agent transcripts onto this PC.
# Quit Cursor first, then:
#   powershell -ExecutionPolicy Bypass -File .\restore-cursor-chat.ps1 -TargetWorkspace "C:\Users\YOU\Notion 2"
#
# PackDir defaults to this script's folder (the travel pack root).

param(
  [Parameter(Mandatory = $true)]
  [string]$TargetWorkspace,
  [string]$PackDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

function Get-CursorProjectKey([string]$Path) {
  $norm = $Path.TrimEnd('\', '/')
  $drive = Split-Path $norm -Qualifier
  if ($drive) {
    $rest = $norm.Substring($drive.Length).TrimStart('\', '/')
    $slug = ($drive.TrimEnd(':').ToLower() + "-" + ($rest -replace '[\\/:\s]+', '-'))
  } else {
    $slug = ($norm -replace '[\\/:\s]+', '-')
  }
  return $slug.ToLower()
}

$cursor = Get-Process -Name "Cursor" -ErrorAction SilentlyContinue
if ($cursor) {
  throw "Close Cursor completely, then re-run restore."
}

$key = Get-CursorProjectKey $TargetWorkspace
$dest = Join-Path $env:USERPROFILE ".cursor\projects\$key\agent-transcripts"
New-Item -ItemType Directory -Path $dest -Force | Out-Null

$srcTranscripts = Join-Path $PackDir "agent-transcripts"
if (-not (Test-Path $srcTranscripts)) {
  throw "No agent-transcripts folder in pack: $srcTranscripts"
}
Copy-Item (Join-Path $srcTranscripts "*") $dest -Recurse -Force
Write-Host "Restored transcripts -> $dest"

$wsSrc = Join-Path $PackDir "workspaceStorage"
if (Test-Path $wsSrc) {
  $wsRoot = Join-Path $env:APPDATA "Cursor\User\workspaceStorage"
  New-Item -ItemType Directory -Path $wsRoot -Force | Out-Null
  Get-ChildItem $wsSrc -Directory | ForEach-Object {
    $target = Join-Path $wsRoot $_.Name
    if (Test-Path $target) { Remove-Item $target -Recurse -Force }
    Copy-Item $_.FullName $target -Recurse -Force
    $wf = Join-Path $target "workspace.json"
    if (Test-Path $wf) {
      $json = Get-Content $wf -Raw
      $uri = "file:///" + ($TargetWorkspace -replace '\\', '/')
      if ($json -match '"folder"\s*:') {
        $json = $json -replace '"folder"\s*:\s*"[^"]*"', ('"folder": "' + $uri + '"')
        Set-Content $wf $json -Encoding UTF8
      }
    }
  }
  Write-Host "Restored workspaceStorage (path rewritten to $TargetWorkspace)"
}

Write-Host "Done. Open Cursor on $TargetWorkspace"
