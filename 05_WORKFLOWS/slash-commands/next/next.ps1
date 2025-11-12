Param()
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."
$cfg = Join-Path $root 'project.config.yml'
$logger = Join-Path $root 'tools\logger\log.ps1'
if (-not (Test-Path -LiteralPath $cfg)) { & $logger next error "missing config"; Write-Host "[/next] Missing project.config.yml — run /init first"; exit 1 }

# naive parse (best-effort)
$build = (Select-String -Path $cfg -Pattern '^  build:' | ForEach-Object { ($_ -split ':\s+',2)[1].Trim('"') })
$test = (Select-String -Path $cfg -Pattern '^  test:' | ForEach-Object { ($_ -split ':\s+',2)[1].Trim('"') })

& $logger next start "Planning next step"
Write-Host "[/next] Planning next step..."
$hasChanges = -not ((git diff --quiet) -and (git diff --cached --quiet))
if (-not $hasChanges) {
  Write-Host "[/next] No pending diffs. Running build and tests."
  & $logger next info "run build+test"
  if ($build) { pwsh -NoProfile -Command $build } else { Write-Host "No build command configured." }
  if ($test) { pwsh -NoProfile -Command $test } else { Write-Host "No test command configured." }
} else {
  Write-Host "[/next] Changes detected. Running review."
  & $logger next info "run review"
  & "$root/05_WORKFLOWS/slash-commands/review/review.ps1"
}

& $logger next end "Done"
Write-Host "[/next] Done."
