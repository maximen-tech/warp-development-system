Param()
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."
$cfg = Join-Path $root 'project.config.yml'
if (-not (Test-Path -LiteralPath $cfg)) { Write-Host "[/next] Missing project.config.yml — run /init first"; exit 1 }

# naive parse (best-effort)
$build = (Select-String -Path $cfg -Pattern '^  build:' | ForEach-Object { ($_ -split ':\s+',2)[1].Trim('"') })
$test = (Select-String -Path $cfg -Pattern '^  test:' | ForEach-Object { ($_ -split ':\s+',2)[1].Trim('"') })

Write-Host "[/next] Planning next step..."
$hasChanges = -not ((git diff --quiet) -and (git diff --cached --quiet))
if (-not $hasChanges) {
  Write-Host "[/next] No pending diffs. Running build and tests."
  if ($build) { pwsh -NoProfile -Command $build } else { Write-Host "No build command configured." }
  if ($test) { pwsh -NoProfile -Command $test } else { Write-Host "No test command configured." }
} else {
  Write-Host "[/next] Changes detected. Running review."
  & "$root/05_WORKFLOWS/slash-commands/review/review.ps1"
}

Write-Host "[/next] Done."
