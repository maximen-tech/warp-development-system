Param([ValidateSet("up","down")][string]$Direction = "up")
$ErrorActionPreference = 'Stop'
Write-Host "[/migrate] Running migrations: $Direction"
# TODO: invoke your migration tool
