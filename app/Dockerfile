# Use official Python image with Node.js pre-installed
FROM nikolaik/python-nodejs:python3.9-nodejs18


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

# Copy startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Expose ports
EXPOSE 3000 5001

# Start both services
CMD ["./docker-entrypoint.sh"] 