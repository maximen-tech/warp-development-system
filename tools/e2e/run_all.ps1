Param()
$ErrorActionPreference = 'Stop'
# Happy path
try { python tools/e2e/run_happy.py | Write-Output } catch { python3 tools/e2e/run_happy.py | Write-Output }
# Escalation + error
try { python tools/e2e/run_escalation.py | Write-Output } catch { python3 tools/e2e/run_escalation.py | Write-Output }
# Edge cases
try { python tools/e2e/run_edge.py | Write-Output } catch { python3 tools/e2e/run_edge.py | Write-Output }
