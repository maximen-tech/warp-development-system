# Stage 1: Build dependencies
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Production runtime
FROM node:20-alpine

LABEL maintainer="Warp Development Team"
LABEL description="Warp Dashboard - AI Agents Development Platform"
LABEL version="1.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S warp && \
    adduser -S warp -u 1001

WORKDIR /app

# Copy dependencies from builder stage
COPY --from=builder --chown=warp:warp /app/node_modules ./node_modules

# Copy application files
COPY --chown=warp:warp . .

# Create required directories with proper permissions
RUN mkdir -p ../../runtime && \
    chown -R warp:warp ../../runtime

# Expose port
EXPOSE 3030

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3030/api/projects', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Switch to non-root user
USER warp

# Set environment variables
ENV NODE_ENV=production \
    PORT=3030 \
    LOG_LEVEL=info

# Start application
CMD ["node", "server.js"]
