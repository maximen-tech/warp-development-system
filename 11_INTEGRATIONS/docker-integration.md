# Docker Integration (Build & Push)

Capabilities
- Build images with caching
- Multi-arch builds

Setup
- Secrets: {{REGISTRY_USER}}, {{REGISTRY_TOKEN}}
- Registry: ghcr.io or Docker Hub

Examples
- `docker buildx build --platform linux/amd64,linux/arm64 -t <image>:<tag> .`
- Push on tag or release
