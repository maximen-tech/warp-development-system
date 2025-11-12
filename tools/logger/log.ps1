Param(
  [Parameter(Mandatory=$true)][string]$Action,
  [Parameter(Mandatory=$true)][string]$Status,
  [Parameter(ValueFromRemainingArguments=$true)][string[]]$Message
)
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\.."
$log = Join-Path $root 'runtime\events.jsonl'
$null = New-Item -ItemType Directory -Force -Path (Split-Path $log) 2>$null
$ts = (Get-Date).ToUniversalTime().ToString("s") + "Z"
$msg = ($Message -join ' ')
$msg = $msg -replace '"','\"'
Add-Content -LiteralPath $log -Value ("{""ts"":""$ts"",""action"":""$Action"",""status"":""$Status"",""message"":""$msg""}")
