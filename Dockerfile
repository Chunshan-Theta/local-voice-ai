# Multi-stage build for Next.js + Python Whisper service
FROM node:18-alpine AS nextjs-builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Python runtime with Whisper
FROM python:3.9-slim

# Fix GPG and install system dependencies
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get update --allow-releaseinfo-change && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    gnupg2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for Next.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get update && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Next.js build from builder stage
COPY --from=nextjs-builder /app/.next ./.next
COPY --from=nextjs-builder /app/node_modules ./node_modules
COPY --from=nextjs-builder /app/package*.json ./
COPY --from=nextjs-builder /app/next.config.js ./
COPY --from=nextjs-builder /app/pages ./pages
COPY --from=nextjs-builder /app/lib ./lib

# Copy Python Whisper service
COPY local_whisper_service.py ./
COPY requirements.txt ./

# Install Python dependencies and download Whisper model
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "import whisper; whisper.load_model('small')"

# Create startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Expose ports
EXPOSE 3000 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:3000/api/health && curl -f http://localhost:5001/health || exit 1

# Start both services
CMD ["./docker-entrypoint.sh"] 