# Terraform Integration (IaC Automation)

Capabilities
- Plan, apply with approval gates
- Policy as code checks (OPA, Sentinel)

Setup
- Secrets: {{AWS_ACCESS_KEY_ID}}, {{AWS_SECRET_ACCESS_KEY}}
- Backend config per workspace

Examples
- `terraform plan -out plan.tfplan`
- Require manual approval before `terraform apply`
