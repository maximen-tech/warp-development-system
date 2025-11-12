Param([string]$Env = "dev")
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" deploy start "env=$Env"
Write-Host "[/deploy] Planning deploy to $Env..."
# TODO: Implement deployment steps (build, push, rollout)
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" deploy end "env=$Env"
Write-Host "[/deploy] Done."
