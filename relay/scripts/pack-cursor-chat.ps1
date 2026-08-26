# Pack Cursor agent chat for another Windows PC.
# Run on the SOURCE machine:
#   powershell -ExecutionPolicy Bypass -File scripts/pack-cursor-chat.ps1
#   powershell -File scripts/pack-cursor-chat.ps1 -OutDir "E:\cursor-travel-pack"
#
# On the laptop (Cursor closed):
#   powershell -File .\restore-cursor-chat.ps1 -TargetWorkspace "C:\Users\YOU\Notion 2"

param(
  [string]$WorkspacePath = "G:\Notion 2",
  [string]$OutDir = ""
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

if (-not $OutDir) {
  # scripts/ -> relay/ -> repo root
  $OutDir = Join-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) "cursor-travel-pack"
}

$projectKey = Get-CursorProjectKey $WorkspacePath
$srcTranscripts = Join-Path $env:USERPROFILE ".cursor\projects\$projectKey\agent-transcripts"
$wsRoot = Join-Path $env:APPDATA "Cursor\User\workspaceStorage"
$restoreSrc = Join-Path $PSScriptRoot "restore-cursor-chat.ps1"

Write-Host "Workspace: $WorkspacePath"
Write-Host "Project key: $projectKey"
Write-Host "Out: $OutDir"

if (-not (Test-Path $restoreSrc)) {
  throw "Missing $restoreSrc"
}

if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
New-Item -ItemType Directory -Path $OutDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutDir "agent-transcripts") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutDir "workspaceStorage") | Out-Null

if (Test-Path $srcTranscripts) {
  Copy-Item -Path (Join-Path $srcTranscripts "*") -Destination (Join-Path $OutDir "agent-transcripts") -Recurse -Force
  Write-Host "Copied agent-transcripts"
} else {
  Write-Warning "No transcripts at $srcTranscripts"
}

$copiedWs = 0
$wsNeedle = ($WorkspacePath -replace '\\', '/')
if (Test-Path $wsRoot) {
  Get-ChildItem $wsRoot -Directory | ForEach-Object {
    $wf = Join-Path $_.FullName "workspace.json"
    if (Test-Path $wf) {
      $raw = Get-Content $wf -Raw -ErrorAction SilentlyContinue
      if ($raw -and $raw.Contains($wsNeedle)) {
        $dest = Join-Path $OutDir "workspaceStorage\$($_.Name)"
        Copy-Item $_.FullName $dest -Recurse -Force
        $copiedWs++
      }
    }
  }
}
Write-Host "Copied workspaceStorage folders: $copiedWs"

Copy-Item $restoreSrc (Join-Path $OutDir "restore-cursor-chat.ps1") -Force

$readme = @(
  "Cursor travel pack"
  "Source workspace: $WorkspacePath"
  "Project key: $projectKey"
  "Packed: $(Get-Date -Format o)"
  ""
  "On the laptop:"
  "1. Install Cursor, sign in, open your Relay folder."
  "2. Quit Cursor completely (including tray)."
  "3. powershell -ExecutionPolicy Bypass -File .\restore-cursor-chat.ps1 -TargetWorkspace `"C:\Users\YOU\Notion 2`""
  "4. Open Cursor again on that folder."
) -join "`r`n"
Set-Content -Path (Join-Path $OutDir "README.txt") -Value $readme -Encoding UTF8

Write-Host ""
Write-Host "Pack ready: $OutDir"
Write-Host "Copy that folder to USB / cloud, then run restore on the laptop."
