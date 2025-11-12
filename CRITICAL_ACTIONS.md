# Critical Actions (Escalation Policy)

Agent must seek explicit human confirmation (type EXACT PHRASE shown) before executing any of:

- Database destructive operations (DROP, TRUNCATE, irreversible migrations)
- Secret rotation or revocation
- Production infrastructure changes (Terraform/Kubernetes apply to prod)
- Data deletions beyond version-controlled files
- Force-push or history rewrites

Escalation protocol
- Present a concise summary of the action and blast radius
- Provide the safest recommended alternative (e.g., dry-run, staging first)
- Require exact confirmation string: I APPROVE THIS CRITICAL ACTION
- Log decision in PR or run summary
