# Use official Python image with Node.js pre-installed
FROM nikolaik/python-nodejs:python3.9-nodejs18

# Install ffmpeg (required by Whisper)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Create tmp directory for temporary files
RUN mkdir -p /app/tmp && chmod 777 /app/tmp

# Copy and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy Next.js source and build
COPY pages ./pages
COPY lib ./lib
COPY *.json ./
COPY *.js ./
COPY *.ts ./
RUN npm run build

# Copy Python service and install dependencies
COPY local_whisper_service.py ./
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download Whisper model (default: small)
ARG WHISPER_MODEL=small
RUN python -c "import whisper; whisper.load_model(\"$WHISPER_MODEL\")"

# Copy startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Expose ports
EXPOSE 3000 5001

# Start both services
CMD ["./docker-entrypoint.sh"] 