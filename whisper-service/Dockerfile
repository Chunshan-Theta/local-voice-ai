# Use official Python image as base
FROM python:3.9-slim

# Install system dependencies (including ffmpeg)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements file and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .

# Create necessary directories
RUN mkdir -p /app/tmp && chmod 777 /app/tmp
RUN mkdir -p /root/.cache/whisper

# Pre-download Whisper model
ARG WHISPER_MODEL=small
RUN python -c "import whisper; whisper.load_model('${WHISPER_MODEL}')"

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5001/health || exit 1

# Use gunicorn to run the app
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "1", "--timeout", "300", "--worker-connections", "1000", "--preload", "app:app"] 