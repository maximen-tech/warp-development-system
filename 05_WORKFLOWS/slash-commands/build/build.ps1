$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" build start "Building project"
Write-Host "[/build] Building project..."
# TODO: build commands
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" build end "Build finished"
