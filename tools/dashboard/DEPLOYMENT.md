# Warp Dashboard - Production Deployment Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [Manual Deployment](#manual-deployment)
- [Security Configuration](#security-configuration)
- [Monitoring & Logging](#monitoring--logging)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- **Node.js**: v18.0.0 or higher (v20 recommended)
- **npm**: v9.0.0 or higher
- **Docker**: v20.10+ (for containerized deployment)
- **Docker Compose**: v2.0+ (for orchestration)

### System Requirements
- **CPU**: 2 cores minimum, 4 cores recommended
- **RAM**: 2GB minimum, 4GB recommended
- **Disk Space**: 10GB available
- **Network**: Ports 3030 (dashboard), 8080 (optional reverse proxy)

## Environment Configuration

### 1. Create Environment File

Create `.env` file in the dashboard root directory:

```bash
# API Keys
ANTHROPIC_API_KEY=your_claude_api_key_here

# Server Configuration
NODE_ENV=production
PORT=3030
LOG_LEVEL=info

# Security (optional - defaults provided)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### 2. Configure Production Settings

Update `server.js` production settings if needed:
- Rate limiting thresholds
- CORS origins
- Session management
- API timeouts

## Docker Deployment

### Quick Start with Docker Compose

```bash
# 1. Build and start services
docker-compose up -d --build

# 2. Check status
docker-compose ps

# 3. View logs
docker-compose logs -f dashboard

# 4. Stop services
docker-compose down

# 5. Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

### Manual Docker Build

```bash
# Build image
docker build -t warp-dashboard:latest .

# Run container
docker run -d \
  --name warp-dashboard \
  -p 3030:3030 \
  -e NODE_ENV=production \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/../../runtime:/app/../../runtime \
  --restart unless-stopped \
  warp-dashboard:latest

# Check health
docker inspect --format='{{json .State.Health}}' warp-dashboard
```

### Docker Registry Deployment

```bash
# Tag for registry
docker tag warp-dashboard:latest registry.example.com/warp-dashboard:1.0.0

# Push to registry
docker push registry.example.com/warp-dashboard:1.0.0

# Pull and run from registry
docker pull registry.example.com/warp-dashboard:1.0.0
docker run -d registry.example.com/warp-dashboard:1.0.0
```

## Manual Deployment

### 1. Install Dependencies

```bash
cd tools/dashboard
npm ci --only=production
```

### 2. Configure System Service (Linux)

Create `/etc/systemd/system/warp-dashboard.service`:

```ini
[Unit]
Description=Warp Dashboard Service
After=network.target

[Service]
Type=simple
User=warp
WorkingDirectory=/opt/warp/tools/dashboard
Environment=NODE_ENV=production
Environment=PORT=3030
EnvironmentFile=/opt/warp/tools/dashboard/.env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
```

Start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable warp-dashboard
sudo systemctl start warp-dashboard
sudo systemctl status warp-dashboard
```

### 3. Configure PM2 (Alternative)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server.js --name warp-dashboard

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

# Monitor
pm2 monit
```

## Security Configuration

### 1. Firewall Rules

```bash
# Allow dashboard port
sudo ufw allow 3030/tcp

# Enable firewall
sudo ufw enable
```

### 2. Reverse Proxy with Nginx

Create `/etc/nginx/sites-available/warp-dashboard`:

```nginx
server {
    listen 80;
    server_name dashboard.example.com;

    # SSL Configuration (recommended)
    # listen 443 ssl http2;
    # ssl_certificate /path/to/cert.pem;
    # ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # SSE support
        proxy_buffering off;
        proxy_read_timeout 86400;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20;
}
```

Enable configuration:

```bash
sudo ln -s /etc/nginx/sites-available/warp-dashboard /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. SSL/TLS with Let's Encrypt

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d dashboard.example.com

# Auto-renewal
sudo certbot renew --dry-run
```

## Monitoring & Logging

### Health Check Endpoint

```bash
# Check application health
curl http://localhost:3030/api/projects

# Expected response: 200 OK
```

### Log Management

```bash
# View logs (systemd)
sudo journalctl -u warp-dashboard -f

# View logs (PM2)
pm2 logs warp-dashboard

# View logs (Docker)
docker-compose logs -f dashboard

# Rotate logs (configure logrotate)
sudo nano /etc/logrotate.d/warp-dashboard
```

### Metrics Collection

Application logs are stored in:
- `runtime/combined.log` - All logs
- `runtime/error.log` - Error logs only
- `runtime/audit.jsonl` - Audit trail
- `runtime/approvals.json` - Approval workflow state

### Monitoring with Prometheus (Optional)

Add metrics endpoint to `server.js` and configure Prometheus scraping.

## Troubleshooting

### Common Issues

#### Port Already in Use

```bash
# Find process using port 3030
sudo lsof -i :3030
# Or
netstat -tuln | grep 3030

# Kill process
sudo kill -9 <PID>
```

#### Permission Errors

```bash
# Fix runtime directory permissions
sudo chown -R warp:warp ../../runtime

# Fix node_modules permissions
sudo chown -R warp:warp node_modules
```

#### Memory Issues

```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" node server.js
```

#### Database Connection Errors

- Ensure runtime directory exists and is writable
- Check file permissions on `.json` and `.jsonl` files
- Verify no file corruption

### Debug Mode

```bash
# Enable debug logging
LOG_LEVEL=debug node server.js

# Enable Node.js debugging
node --inspect server.js
```

### Container Issues

```bash
# Inspect container
docker inspect warp-dashboard

# Execute shell in container
docker exec -it warp-dashboard sh

# Check container logs
docker logs warp-dashboard --tail 100 -f

# Restart container
docker restart warp-dashboard
```

## Performance Optimization

### Recommendations

1. **Enable caching**: Use Redis for session management
2. **Load balancing**: Run multiple instances behind nginx
3. **CDN**: Serve static assets from CDN
4. **Database**: Migrate from file-based to proper database (PostgreSQL)
5. **Monitoring**: Implement APM (Application Performance Monitoring)

### Scaling

```bash
# Docker Swarm (multi-node)
docker swarm init
docker stack deploy -c docker-compose.yml warp

# Kubernetes (advanced)
kubectl apply -f k8s/deployment.yaml
```

## Backup & Recovery

### Backup Strategy

```bash
# Backup runtime data
tar -czf warp-backup-$(date +%Y%m%d).tar.gz ../../runtime

# Automated backup script
0 2 * * * /usr/local/bin/backup-warp.sh
```

### Recovery

```bash
# Restore from backup
tar -xzf warp-backup-20250115.tar.gz -C /path/to/restore
```

## Support

For issues and questions:
- **Documentation**: [docs/](docs/)
- **API Reference**: [docs/openapi.json](docs/openapi.json)
- **GitHub Issues**: Create an issue with detailed logs

---

**Version**: 1.0.0  
**Last Updated**: 2025-01-13
