# Multi-stage Dockerfile for api-catalogue
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Patch les paquets OS de l'image de base (ex: CVE critiques openssl/libcrypto déjà
# corrigées en amont mais pas encore dans le tag node:18-alpine au moment du build).
RUN apk update && apk upgrade --no-cache

# Copy node_modules from build stage
COPY --from=build /app/node_modules ./node_modules

# Copy app files
COPY app.js ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/catalogue || exit 1

# Default command
CMD ["node", "app.js"]