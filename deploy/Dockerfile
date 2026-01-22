# Claude RPG - Docker Image
#
# NOTE: Docker deployment is for serving the UI/API only.
# Tmux monitoring requires running directly on host since tmux sessions
# are host-local and cannot be accessed from within a container.
#
# For full functionality, use the systemd service (install.sh).

FROM node:20-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    jq \
    tmux \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built files
COPY dist/ ./dist/
COPY hooks/ ./hooks/
COPY shared/ ./shared/

# Create data directory
RUN mkdir -p /data

# Environment
ENV NODE_ENV=production
ENV CLAUDE_RPG_PORT=4011
ENV CLAUDE_RPG_DATA_DIR=/data

EXPOSE 4011

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4011/health || exit 1

CMD ["node", "dist/server/index.js"]
