# Multi-stage Dockerfile for frontend
FROM nginx:alpine AS base

# Copy static files
COPY index.html /usr/share/nginx/html/index.html

# Expose port
EXPOSE 80

# Default command
CMD ["nginx", "-g", "daemon off;"]