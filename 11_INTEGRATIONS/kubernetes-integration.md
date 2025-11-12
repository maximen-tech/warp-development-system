# Kubernetes Integration (K8s Automation)

Capabilities
- Deployments, rollouts, and health checks
- Secrets and configmaps management

Setup
- kubeconfig context per env
- Secrets: {{KUBECONFIG}}, {{REGISTRY_TOKEN}}

Examples
- `kubectl rollout status deploy/<name>` in scripts
- Blue/green or canary deploy workflow
