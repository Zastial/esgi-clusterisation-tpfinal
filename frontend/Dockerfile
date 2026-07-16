# Multi-stage Dockerfile for frontend
FROM nginx:alpine AS base

# Patch les paquets OS de l'image de base (ex: CVE critiques openssl/libcrypto déjà
# corrigées en amont mais pas encore dans le tag nginx:alpine au moment du build).
RUN apk update && apk upgrade --no-cache

# Copy static files
COPY index.html /usr/share/nginx/html/index.html

# Expose port
EXPOSE 80

# Default command
CMD ["nginx", "-g", "daemon off;"]