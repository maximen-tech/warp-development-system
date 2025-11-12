Param([int]$Cycles = 3)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."
for ($i = 1; $i -le $Cycles; $i++) {
  Write-Host "[/autopilot] Cycle $i/$Cycles"
  & "$root/05_WORKFLOWS/slash-commands/next/next.ps1" | Out-Host
}
Write-Host "[/autopilot] Completed $Cycles cycles."
