# 30 Prompts by Category

DevOps Automation
1. Bump service version and update deploy manifests
2. Generate CI cache for build dependencies
3. Create rollback workflow for last release
4. Add security scan job with SARIF export
5. Provision staging namespace (dry-run)

Debugging & Troubleshooting
1. Identify failing tests by module and propose fixes
2. Collect logs for service X and summarize top errors
3. Add retry with exponential backoff to API client
4. Detect slowest endpoints with suggested optimizations
5. Reproduce bug from issue description, generate steps

Security & Compliance
1. Add SAST to pipeline with severity gating
2. Scan dependencies and open PR for vulnerable packages
3. Enforce secret redaction in logs and diffs
4. Add IaC policy checks (terraform plan gate)
5. Create incident response template for P1s

Performance Optimization
1. Profile service and propose top 3 code hot-path fixes
2. Add load test script and baseline thresholds
3. Optimize Dockerfile layers and caching
4. Enable HTTP/2 and tuning for reverse proxy
5. Reduce DB round trips via batching

Documentation Generation
1. Generate API reference from source annotations
2. Create architecture diagram and ADR skeleton
3. Produce changelog from git history (semantic)
4. Update README quickstart and examples
5. Document runbooks for incident class X

Team Enablement
1. Scaffold onboarding checklist for new devs
2. Propose team space structure and permissions
3. Build shared workflow set for platform team
4. Create role-specific cheat sheets (dev/devops/lead)
5. Add feedback loop and metrics report template
